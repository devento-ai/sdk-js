import { describe, expect, it, beforeEach, mock } from "bun:test";
import { Tavor } from "../src/client";
import {
  AuthenticationError,
  NotFoundError,
  ServerError,
} from "../src/exceptions";
import { BoxTemplate, BoxState } from "../src/models";
import { BoxHandle } from "../src/box-handle";

describe("Tavor Client", () => {
  describe("constructor", () => {
    it("should throw AuthenticationError when no API key is provided", () => {
      process.env.TAVOR_API_KEY = "";
      expect(() => new Tavor()).toThrow(AuthenticationError);
    });

    it("should use environment variables for configuration", () => {
      process.env.TAVOR_API_KEY = "test-key";
      process.env.TAVOR_BASE_URL = "https://test.tavor.dev";

      const client = new Tavor();
      expect(client).toBeDefined();
    });

    it("should prefer constructor config over environment variables", () => {
      process.env.TAVOR_API_KEY = "env-key";
      process.env.TAVOR_BASE_URL = "https://env.tavor.dev";

      const client = new Tavor({
        apiKey: "constructor-key",
        baseUrl: "https://constructor.tavor.dev",
      });

      expect(client).toBeDefined();
    });
  });

  describe("API methods", () => {
    let client: Tavor;
    let mockHttpClient: {
      post: ReturnType<typeof mock>;
      get: ReturnType<typeof mock>;
      delete: ReturnType<typeof mock>;
      request: ReturnType<typeof mock>;
      interceptors: {
        response: { use: ReturnType<typeof mock> };
      };
    };

    beforeEach(() => {
      mockHttpClient = {
        post: mock(() => {}),
        get: mock(() => {}),
        delete: mock(() => {}),
        request: mock(() => {}),
        interceptors: {
          response: { use: mock(() => {}) },
        },
      };

      client = new Tavor({
        apiKey: "test-key",
        httpClient: mockHttpClient as any, // Type assertion needed for mock
      });
    });

    describe("createBox", () => {
      it("should create a box with default config", async () => {
        mockHttpClient.post.mockResolvedValue({
          data: { id: "box-123" },
        });

        const boxHandle = await client.createBox();

        expect(mockHttpClient.post).toHaveBeenCalledWith("/api/v2/boxes", {
          box_template: BoxTemplate.BASIC,
        });
        expect(boxHandle.id).toBe("box-123");
      });

      it("should create a box with custom config", async () => {
        mockHttpClient.post.mockResolvedValue({
          data: { id: "box-123" },
        });

        const boxHandle = await client.createBox({
          template: BoxTemplate.BASIC,
          timeout: 600,
          metadata: { purpose: "testing" },
        });

        expect(mockHttpClient.post).toHaveBeenCalledWith("/api/v2/boxes", {
          box_template: BoxTemplate.BASIC,
          timeout: 600,
          metadata: { purpose: "testing" },
        });
        expect(boxHandle.id).toBe("box-123");
      });

      it("should use environment variable for default template", async () => {
        process.env.TAVOR_BOX_TEMPLATE = "Pro";

        mockHttpClient.post.mockResolvedValue({
          data: { id: "box-123" },
        });

        await client.createBox();

        expect(mockHttpClient.post).toHaveBeenCalledWith("/api/v2/boxes", {
          box_template: "Pro",
        });

        // Clean up
        delete process.env.TAVOR_BOX_TEMPLATE;
      });
    });

    describe("listBoxes", () => {
      it("should return list of boxes", async () => {
        const mockBoxes = [
          {
            id: "box-1",
            status: BoxState.RUNNING,
            timeout: 600,
            created_at: new Date().toISOString(),
          },
          {
            id: "box-2",
            status: BoxState.STOPPED,
            timeout: 900,
            created_at: new Date().toISOString(),
          },
        ];

        mockHttpClient.get.mockResolvedValue({
          data: { data: mockBoxes },
        });

        const boxes = await client.listBoxes();

        expect(mockHttpClient.get).toHaveBeenCalledWith("/api/v2/boxes");
        expect(boxes).toHaveLength(2);
        expect(boxes[0].id).toBe("box-1");
      });
    });

    describe("getBox", () => {
      it("should return a BoxHandle for the given box ID", async () => {
        const boxId = "box-123";
        const boxHandle = await client.getBox(boxId);

        expect(boxHandle).toBeInstanceOf(BoxHandle);
        expect(boxHandle.id).toBe(boxId);
      });
    });

    describe("withSandbox", () => {
      it("should create a box, run callback, and stop the box", async () => {
        mockHttpClient.post.mockResolvedValue({
          data: { id: "box-123" },
        });

        // Mock request method for BoxHandle operations
        mockHttpClient.request.mockImplementation((config) => {
          if (config.method === "GET" && config.url.includes("/api/v2/boxes")) {
            return Promise.resolve({
              data: {
                data: [
                  {
                    id: "box-123",
                    status: BoxState.RUNNING,
                    timeout: 600,
                    created_at: new Date().toISOString(),
                  },
                ],
              },
            });
          } else if (config.method === "DELETE") {
            return Promise.resolve({
              data: { message: "Box stopped" },
            });
          }
          return Promise.resolve({ data: {} });
        });

        const result = await client.withSandbox(async (box) => {
          expect(box).toBeInstanceOf(BoxHandle);
          return "test-result";
        });

        expect(result).toBe("test-result");
        expect(mockHttpClient.post).toHaveBeenCalledWith("/api/v2/boxes", {
          box_template: BoxTemplate.BASIC,
          timeout: 600,
        });
        expect(mockHttpClient.request).toHaveBeenCalledWith(
          expect.objectContaining({ method: "DELETE" }),
        );
      });

      it("should use custom timeout from config", async () => {
        mockHttpClient.post.mockResolvedValue({
          data: { id: "box-123" },
        });

        // Mock request method for BoxHandle operations
        mockHttpClient.request.mockImplementation((config) => {
          if (config.method === "GET" && config.url.includes("/api/v2/boxes")) {
            return Promise.resolve({
              data: {
                data: [
                  {
                    id: "box-123",
                    status: BoxState.RUNNING,
                    timeout: 300,
                    created_at: new Date().toISOString(),
                  },
                ],
              },
            });
          } else if (config.method === "DELETE") {
            return Promise.resolve({
              data: { message: "Box stopped" },
            });
          }
          return Promise.resolve({ data: {} });
        });

        await client.withSandbox(
          async () => {
            return "result";
          },
          { timeout: 300 },
        );

        expect(mockHttpClient.post).toHaveBeenCalledWith("/api/v2/boxes", {
          box_template: BoxTemplate.BASIC,
          timeout: 300,
        });
      });

      it("should handle errors in callback but still stop the box", async () => {
        mockHttpClient.post.mockResolvedValue({
          data: { id: "box-123" },
        });

        // Mock request method for BoxHandle operations
        mockHttpClient.request.mockImplementation((config) => {
          if (config.method === "GET" && config.url.includes("/api/v2/boxes")) {
            return Promise.resolve({
              data: {
                data: [
                  {
                    id: "box-123",
                    status: BoxState.RUNNING,
                    timeout: 600,
                    created_at: new Date().toISOString(),
                  },
                ],
              },
            });
          } else if (config.method === "DELETE") {
            return Promise.resolve({
              data: { message: "Box stopped" },
            });
          }
          return Promise.resolve({ data: {} });
        });

        const error = new Error("Callback error");

        expect(
          client.withSandbox(async () => {
            throw error;
          }),
        ).rejects.toThrow("Callback error");

        expect(mockHttpClient.request).toHaveBeenCalledWith(
          expect.objectContaining({ method: "DELETE" }),
        );
      });

      it("should handle errors when stopping the box", async () => {
        mockHttpClient.post.mockResolvedValue({
          data: { id: "box-123" },
        });

        // Mock request method for BoxHandle operations
        mockHttpClient.request.mockImplementation((config) => {
          if (config.method === "GET" && config.url.includes("/api/v2/boxes")) {
            return Promise.resolve({
              data: {
                data: [
                  {
                    id: "box-123",
                    status: BoxState.RUNNING,
                    timeout: 600,
                    created_at: new Date().toISOString(),
                  },
                ],
              },
            });
          } else if (config.method === "DELETE") {
            return Promise.reject(new Error("Stop failed"));
          }
          return Promise.resolve({ data: {} });
        });

        // Mock console.error to verify it's called
        const originalConsoleError = console.error;
        const mockConsoleError = mock(() => {});
        console.error = mockConsoleError;

        try {
          const result = await client.withSandbox(async () => {
            return "result";
          });

          expect(result).toBe("result");
          expect(mockConsoleError).toHaveBeenCalledWith(
            expect.stringContaining("Failed to stop box box-123:"),
            expect.any(Error),
          );
        } finally {
          console.error = originalConsoleError;
        }
      });

      it("should use environment variable for default timeout", async () => {
        process.env.TAVOR_BOX_TIMEOUT = "300";

        mockHttpClient.post.mockResolvedValue({
          data: { id: "box-123" },
        });

        // Mock request method for BoxHandle operations
        mockHttpClient.request.mockImplementation((config) => {
          if (config.method === "GET" && config.url.includes("/api/v2/boxes")) {
            return Promise.resolve({
              data: {
                data: [
                  {
                    id: "box-123",
                    status: BoxState.RUNNING,
                    timeout: 300,
                    created_at: new Date().toISOString(),
                  },
                ],
              },
            });
          } else if (config.method === "DELETE") {
            return Promise.resolve({
              data: { message: "Box stopped" },
            });
          }
          return Promise.resolve({ data: {} });
        });

        await client.withSandbox(async () => {
          return "result";
        });

        expect(mockHttpClient.post).toHaveBeenCalledWith("/api/v2/boxes", {
          box_template: BoxTemplate.BASIC,
          timeout: 300,
        });

        // Clean up
        delete process.env.TAVOR_BOX_TIMEOUT;
      });
    });
  });

  describe("Error interceptor", () => {
    it("should map HTTP errors correctly", async () => {
      const mockAxios = {
        create: mock(() => {
          const instance = {
            post: mock(() => {}),
            get: mock(() => {}),
            delete: mock(() => {}),
            request: mock(() => {}),
            interceptors: {
              response: {
                use: mock((successHandler, errorHandler) => {
                  // Store the error handler for testing
                  instance.errorHandler = errorHandler;
                }),
              },
            },
            errorHandler: null,
          };
          return instance;
        }),
      };

      new Tavor({
        apiKey: "test-key",
        httpClient: mockAxios.create() as any,
      });

      const httpClient = mockAxios.create.mock.results[0].value;
      const errorHandler = httpClient.errorHandler;

      // Test 404 error with response
      const error404 = {
        response: {
          status: 404,
          data: { error: "Box not found" },
        },
        request: {},
        message: "Not found",
      };

      expect(() => errorHandler(error404)).toThrow(NotFoundError);

      // Test 500 error with response
      const error500 = {
        response: {
          status: 500,
          data: { error: "Server error" },
        },
        request: {},
        message: "Internal server error",
      };

      expect(() => errorHandler(error500)).toThrow(ServerError);

      // Test error with request but no response
      const requestError = {
        request: {},
        message: "Network error",
      };

      expect(() => errorHandler(requestError)).toThrow(
        "Request failed: Network error",
      );

      // Test error with neither request nor response
      const generalError = {
        message: "Unknown error",
      };

      expect(() => errorHandler(generalError)).toThrow("Error: Unknown error");
    });
  });

  describe("createBox with templateId", () => {
    let client: Tavor;
    let mockHttpClient: any;

    beforeEach(() => {
      mockHttpClient = {
        post: mock(() => {}),
        get: mock(() => {}),
        delete: mock(() => {}),
        request: mock(() => {}),
        interceptors: {
          response: { use: mock(() => {}) },
        },
      };

      client = new Tavor({
        apiKey: "test-key",
        httpClient: mockHttpClient,
      });
    });

    it("should use templateId when provided", async () => {
      mockHttpClient.post.mockResolvedValue({
        data: { id: "box-123" },
      });

      await client.createBox({
        templateId: "custom-template-id",
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith("/api/v2/boxes", {
        templateId: "custom-template-id",
      });
    });

    it("should use environment variable as templateId when not a known template", async () => {
      process.env.TAVOR_BOX_TEMPLATE = "custom-template-id";

      mockHttpClient.post.mockResolvedValue({
        data: { id: "box-123" },
      });

      await client.createBox();

      expect(mockHttpClient.post).toHaveBeenCalledWith("/api/v2/boxes", {
        templateId: "custom-template-id",
      });

      // Clean up
      delete process.env.TAVOR_BOX_TEMPLATE;
    });
  });
});
