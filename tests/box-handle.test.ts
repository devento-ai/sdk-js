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
      baseUrl: "https://api.tavor.dev",
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
        baseUrl: "https://api.tavor.dev",
        httpClient: mockHttpClient,
      });
      expect(handle.state).toBe(BoxState.QUEUED);
    });

    it("should return box metadata", () => {
      const boxWithMetadata = { ...mockBox, metadata: { test: "value" } };
      const handle = new BoxHandle(boxWithMetadata, {
        apiKey: "test-key",
        baseUrl: "https://api.tavor.dev",
        httpClient: mockHttpClient,
      });
      expect(handle.metadata).toEqual({ test: "value" });
    });
  });

  describe("refresh", () => {
    it("should update box status", async () => {
      const updatedBox = { ...mockBox, status: BoxState.STOPPED };
      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: [updatedBox] },
      });

      await boxHandle.refresh();
      expect(boxHandle.state).toBe(BoxState.STOPPED);
    });
  });

  describe("waitUntilReady", () => {
    it("should return immediately if box is already running", async () => {
      // Box is already in RUNNING state, so it should return immediately
      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: [mockBox] },
      });

      await boxHandle.waitUntilReady();
      // refresh() should be called once to check the state
      expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
    });

    it("should poll until box is running", async () => {
      const startingBox = { ...mockBox, status: BoxState.BOOTING };
      const handle = new BoxHandle(startingBox, {
        apiKey: "test-key",
        baseUrl: "https://api.tavor.dev",
        httpClient: mockHttpClient,
      });

      mockHttpClient.request
        .mockResolvedValueOnce({
          data: { data: [{ ...mockBox, status: BoxState.BOOTING }] },
        })
        .mockResolvedValueOnce({
          data: { data: [{ ...mockBox, status: BoxState.RUNNING }] },
        });

      await handle.waitUntilReady(5000);
      expect(mockHttpClient.request).toHaveBeenCalledTimes(2);
    });

    it("should throw error if box fails", async () => {
      const failedBox = { ...mockBox, status: BoxState.FAILED };
      const handle = new BoxHandle(failedBox, {
        apiKey: "test-key",
        baseUrl: "https://api.tavor.dev",
        httpClient: mockHttpClient,
      });

      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: [failedBox] },
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

      const commandResponses = [
        {
          command: {
            id: "cmd-123",
            status: CommandState.RUNNING,
            command: "test",
            stdout: "line1\n",
          },
        },
        {
          command: {
            id: "cmd-123",
            status: CommandState.RUNNING,
            command: "test",
            stdout: "line1\nline2\n",
          },
        },
        {
          command: {
            id: "cmd-123",
            status: CommandState.DONE,
            command: "test",
            stdout: "line1\nline2\n",
            stderr: "",
            exit_code: 0,
          },
        },
      ];

      mockHttpClient.request
        .mockResolvedValueOnce({ data: { id: "cmd-123" } })
        .mockResolvedValueOnce({ data: commandResponses[0].command })
        .mockResolvedValueOnce({ data: commandResponses[1].command })
        .mockResolvedValueOnce({ data: commandResponses[2].command });

      await boxHandle.run("test", {
        onStdout: (line) => stdout.push(line),
        onStderr: (line) => stderr.push(line),
        pollInterval: 10,
      });

      expect(stdout).toEqual(["line1", "line2"]);
    });
  });

  describe("stop", () => {
    it("should send delete request if box is running", async () => {
      await boxHandle.stop();
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "DELETE",
          url: "https://api.tavor.dev/api/v2/boxes/box-123",
        }),
      );
    });

    it("should not send delete request if box is already stopped", async () => {
      const stoppedBox = { ...mockBox, status: BoxState.STOPPED };
      const handle = new BoxHandle(stoppedBox, {
        apiKey: "test-key",
        baseUrl: "https://api.tavor.dev",
        httpClient: mockHttpClient,
      });

      await handle.stop();
      expect(mockHttpClient.request).not.toHaveBeenCalled();
    });
  });
});
