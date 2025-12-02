import { describe, expect, it, beforeEach, mock } from "bun:test";
import { BoxHandle } from "../src/box-handle";
import { Box, BoxState, CommandState } from "../src/models";
import { BoxTimeoutError } from "../src/exceptions";

describe("BoxHandle", () => {
  let mockHttpClient: any;
  let mockBox: Box;
  let boxHandle: BoxHandle;

  beforeEach(() => {
    mockHttpClient = {
      request: mock(() => Promise.resolve({ data: {} })),
    };

    mockBox = {
      id: "box-123",
      status: BoxState.RUNNING,
      timeout: 600,
      created_at: new Date().toISOString(),
    };

    boxHandle = new BoxHandle(mockBox, {
      apiKey: "test-key",
      baseUrl: "https://api.devento.ai",
      httpClient: mockHttpClient,
      timeout: 30000,
    });
  });

  describe("getters", () => {
    it("should return box id", () => {
      expect(boxHandle.id).toBe("box-123");
    });

    it("should return box state", () => {
      expect(boxHandle.state).toBe(BoxState.RUNNING);
    });

    it("should return QUEUED state when box is not loaded", () => {
      const handle = new BoxHandle("box-456", {
        apiKey: "test-key",
        baseUrl: "https://api.devento.ai",
        httpClient: mockHttpClient,
      });
      expect(handle.state).toBe(BoxState.QUEUED);
    });

    it("should return box metadata", () => {
      const boxWithMetadata = { ...mockBox, metadata: { test: "value" } };
      const handle = new BoxHandle(boxWithMetadata, {
        apiKey: "test-key",
        baseUrl: "https://api.devento.ai",
        httpClient: mockHttpClient,
      });
      expect(handle.metadata).toEqual({ test: "value" });
    });

    it("should return watermarkEnabled when set", () => {
      const boxWithWatermark = { ...mockBox, watermark_enabled: true };
      const handle = new BoxHandle(boxWithWatermark, {
        apiKey: "test-key",
        baseUrl: "https://api.devento.ai",
        httpClient: mockHttpClient,
      });
      expect(handle.watermarkEnabled).toBe(true);
    });

    it("should return undefined for watermarkEnabled when not set", () => {
      expect(boxHandle.watermarkEnabled).toBeUndefined();
    });
  });

  describe("refresh", () => {
    it("should update box status", async () => {
      const updatedBox = { ...mockBox, status: BoxState.STOPPED };
      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: updatedBox },
      });

      await boxHandle.refresh();
      expect(boxHandle.state).toBe(BoxState.STOPPED);
    });
  });

  describe("waitUntilReady", () => {
    it("should return immediately if box is already running", async () => {
      // Box is already in RUNNING state, so it should return immediately
      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: mockBox },
      });

      await boxHandle.waitUntilReady();
      // refresh() should be called once to check the state
      expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
    });

    it("should poll until box is running", async () => {
      const startingBox = { ...mockBox, status: BoxState.BOOTING };
      const handle = new BoxHandle(startingBox, {
        apiKey: "test-key",
        baseUrl: "https://api.devento.ai",
        httpClient: mockHttpClient,
      });

      mockHttpClient.request
        .mockResolvedValueOnce({
          data: { data: { ...mockBox, status: BoxState.BOOTING } },
        })
        .mockResolvedValueOnce({
          data: { data: { ...mockBox, status: BoxState.RUNNING } },
        });

      await handle.waitUntilReady(5000);
      expect(mockHttpClient.request).toHaveBeenCalledTimes(2);
    });

    it("should throw error if box fails", async () => {
      const failedBox = { ...mockBox, status: BoxState.FAILED };
      const handle = new BoxHandle(failedBox, {
        apiKey: "test-key",
        baseUrl: "https://api.devento.ai",
        httpClient: mockHttpClient,
      });

      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: failedBox },
      });

      await expect(handle.waitUntilReady()).rejects.toThrow(BoxTimeoutError);
    });
  });

  describe("run", () => {
    it("should execute command and return result", async () => {
      const commandResponse = {
        command: {
          id: "cmd-123",
          status: CommandState.DONE,
          command: "echo test",
          stdout: "test\n",
          stderr: "",
          exit_code: 0,
          created_at: new Date().toISOString(),
        },
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: { id: "cmd-123" } })
        .mockResolvedValueOnce({ data: commandResponse.command });

      const result = await boxHandle.run("echo test");
      expect(result.stdout).toBe("test\n");
      expect(result.exitCode).toBe(0);
      expect(result.state).toBe(CommandState.DONE);
    });

    it("should stream output via callbacks", async () => {
      const stdout: string[] = [];
      const stderr: string[] = [];

      // Create a mock SSE stream
      const mockStream = {
        on: mock((event: string, callback: Function) => {
          if (event === "data") {
            // Simulate SSE events
            setTimeout(() => {
              callback(
                Buffer.from(
                  'event: start\ndata: {"command_id":"cmd-123","status":"queued"}\n\n',
                ),
              );
              callback(
                Buffer.from('event: output\ndata: {"stdout":"line1\\n"}\n\n'),
              );
              callback(
                Buffer.from('event: output\ndata: {"stdout":"line2\\n"}\n\n'),
              );
              callback(
                Buffer.from(
                  'event: status\ndata: {"status":"done","exit_code":0}\n\n',
                ),
              );
              callback(Buffer.from('event: end\ndata: {"status":"done"}\n\n'));
            }, 0);
          } else if (event === "error") {
            // No error
          } else if (event === "end") {
            // Stream ends after sending events
            setTimeout(() => callback(), 10);
          }
          return mockStream;
        }),
        destroy: mock(() => {}),
      };

      mockHttpClient.request.mockResolvedValueOnce({
        data: mockStream,
        status: 200,
      });

      const result = await boxHandle.run("test", {
        onStdout: (line) => stdout.push(line),
        onStderr: (line) => stderr.push(line),
      });

      expect(stdout).toEqual(["line1", "line2"]);
      expect(stderr).toEqual([]);
      expect(result.exitCode).toBe(0);
    });
  });

  describe("stop", () => {
    it("should send delete request if box is running", async () => {
      await boxHandle.stop();
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "DELETE",
          url: "https://api.devento.ai/api/v2/boxes/box-123",
        }),
      );
    });

    it("should not send delete request if box is already stopped", async () => {
      const stoppedBox = { ...mockBox, status: BoxState.STOPPED };
      const handle = new BoxHandle(stoppedBox, {
        apiKey: "test-key",
        baseUrl: "https://api.devento.ai",
        httpClient: mockHttpClient,
      });

      await handle.stop();
      expect(mockHttpClient.request).not.toHaveBeenCalled();
    });
  });

  describe("getPublicUrl", () => {
    it("should return correct public URL when hostname is available", () => {
      const boxWithHostname = { ...mockBox, hostname: "abc123.deven.to" };
      const handle = new BoxHandle(boxWithHostname, {
        apiKey: "test-key",
        baseUrl: "https://api.devento.ai",
        httpClient: mockHttpClient,
      });

      const url = handle.getPublicUrl(3000);
      expect(url).toBe("https://3000-abc123.deven.to");
    });

    it("should throw error when hostname is not available", () => {
      expect(() => boxHandle.getPublicUrl(3000)).toThrow(
        "Box does not have a hostname. Ensure the box is created and running.",
      );
    });

    it("should handle different port numbers correctly", () => {
      const boxWithHostname = { ...mockBox, hostname: "xyz789.deven.to" };
      const handle = new BoxHandle(boxWithHostname, {
        apiKey: "test-key",
        baseUrl: "https://api.devento.ai",
        httpClient: mockHttpClient,
      });

      expect(handle.getPublicUrl(80)).toBe("https://80-xyz789.deven.to");
      expect(handle.getPublicUrl(8080)).toBe("https://8080-xyz789.deven.to");
      expect(handle.getPublicUrl(1337)).toBe("https://1337-xyz789.deven.to");
    });
  });

  describe("exposePort", () => {
    it("should expose a port successfully", async () => {
      const exposedPort = {
        proxy_port: 12345,
        target_port: 3000,
        expires_at: "2024-12-31T23:59:59Z",
      };

      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: exposedPort },
      });

      const result = await boxHandle.exposePort(3000);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "https://api.devento.ai/api/v2/boxes/box-123/expose_port",
          data: { port: 3000 },
        }),
      );

      expect(result).toEqual(exposedPort);
    });

    it("should handle different port numbers", async () => {
      const exposedPort = {
        proxy_port: 54321,
        target_port: 8080,
        expires_at: "2024-12-31T23:59:59Z",
      };

      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: exposedPort },
      });

      const result = await boxHandle.exposePort(8080);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "https://api.devento.ai/api/v2/boxes/box-123/expose_port",
          data: { port: 8080 },
        }),
      );

      expect(result.target_port).toBe(8080);
      expect(result.proxy_port).toBe(54321);
    });
  });

  describe("pause", () => {
    it("should pause the box successfully", async () => {
      // Mock the pause request
      mockHttpClient.request.mockResolvedValueOnce({
        data: {},
      });

      // Mock the refresh request
      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: { ...mockBox, status: BoxState.STOPPED } },
      });

      await boxHandle.pause();

      // First call should be the pause request
      expect(mockHttpClient.request).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          method: "POST",
          url: "https://api.devento.ai/api/v2/boxes/box-123/pause",
        }),
      );

      // Second call should be the refresh request
      expect(mockHttpClient.request).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          method: "GET",
          url: "https://api.devento.ai/api/v2/boxes/box-123",
        }),
      );

      expect(mockHttpClient.request).toHaveBeenCalledTimes(2);
    });

    it("should handle pause errors", async () => {
      mockHttpClient.request.mockRejectedValueOnce(new Error("Pause failed"));

      await expect(boxHandle.pause()).rejects.toThrow("Pause failed");
    });
  });

  describe("resume", () => {
    it("should resume the box successfully", async () => {
      // Mock the resume request
      mockHttpClient.request.mockResolvedValueOnce({
        data: {},
      });

      // Mock the refresh request
      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: { ...mockBox, status: BoxState.RUNNING } },
      });

      await boxHandle.resume();

      // First call should be the resume request
      expect(mockHttpClient.request).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          method: "POST",
          url: "https://api.devento.ai/api/v2/boxes/box-123/resume",
        }),
      );

      // Second call should be the refresh request
      expect(mockHttpClient.request).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          method: "GET",
          url: "https://api.devento.ai/api/v2/boxes/box-123",
        }),
      );

      expect(mockHttpClient.request).toHaveBeenCalledTimes(2);
    });

    it("should handle resume errors", async () => {
      mockHttpClient.request.mockRejectedValueOnce(new Error("Resume failed"));

      await expect(boxHandle.resume()).rejects.toThrow("Resume failed");
    });
  });

  describe("setWatermark", () => {
    it("should enable watermark successfully", async () => {
      // Mock the setWatermark request
      mockHttpClient.request.mockResolvedValueOnce({
        data: {},
      });

      // Mock the refresh request
      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: { ...mockBox, watermark_enabled: true } },
      });

      await boxHandle.setWatermark(true);

      // First call should be the PATCH request
      expect(mockHttpClient.request).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          method: "PATCH",
          url: "https://api.devento.ai/api/v2/boxes/box-123",
          data: { watermark_enabled: true },
        }),
      );

      // Second call should be the refresh request
      expect(mockHttpClient.request).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          method: "GET",
          url: "https://api.devento.ai/api/v2/boxes/box-123",
        }),
      );

      expect(boxHandle.watermarkEnabled).toBe(true);
    });

    it("should disable watermark successfully", async () => {
      const boxWithWatermark = { ...mockBox, watermark_enabled: true };
      const handle = new BoxHandle(boxWithWatermark, {
        apiKey: "test-key",
        baseUrl: "https://api.devento.ai",
        httpClient: mockHttpClient,
      });

      // Mock the setWatermark request
      mockHttpClient.request.mockResolvedValueOnce({
        data: {},
      });

      // Mock the refresh request
      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: { ...mockBox, watermark_enabled: false } },
      });

      await handle.setWatermark(false);

      expect(mockHttpClient.request).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          method: "PATCH",
          url: "https://api.devento.ai/api/v2/boxes/box-123",
          data: { watermark_enabled: false },
        }),
      );

      expect(handle.watermarkEnabled).toBe(false);
    });

    it("should handle setWatermark errors", async () => {
      mockHttpClient.request.mockRejectedValueOnce(
        new Error("Failed to update watermark"),
      );

      await expect(boxHandle.setWatermark(true)).rejects.toThrow(
        "Failed to update watermark",
      );
    });
  });
});
