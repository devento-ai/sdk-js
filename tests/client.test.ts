import { describe, expect, it, beforeEach, mock } from "bun:test";
import { Devento } from "../src/client";
import {
  AuthenticationError,
  NotFoundError,
  ServerError,
} from "../src/exceptions";
import {
  BoxState,
  DomainKind,
  DomainStatus,
  CreateDomainRequest,
} from "../src/models";
import { BoxHandle } from "../src/box-handle";

describe("Devento Client", () => {
  describe("constructor", () => {
    it("should throw AuthenticationError when no API key is provided", () => {
      process.env.DEVENTO_API_KEY = "";
      expect(() => new Devento()).toThrow(AuthenticationError);
    });

    it("should use environment variables for configuration", () => {
      process.env.DEVENTO_API_KEY = "test-key";
      process.env.DEVENTO_BASE_URL = "https://test.devento.ai";

      const client = new Devento();
      expect(client).toBeDefined();
    });

    it("should prefer constructor config over environment variables", () => {
      process.env.DEVENTO_API_KEY = "env-key";
      process.env.DEVENTO_BASE_URL = "https://env.devento.ai";

      const client = new Devento({
        apiKey: "constructor-key",
        baseUrl: "https://constructor.devento.ai",
      });

      expect(client).toBeDefined();
    });
  });

  describe("API methods", () => {
    let client: Devento;
    let mockHttpClient: {
      post: ReturnType<typeof mock>;
      get: ReturnType<typeof mock>;
      delete: ReturnType<typeof mock>;
      patch: ReturnType<typeof mock>;
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
        patch: mock(() => {}),
        request: mock(() => {}),
        interceptors: {
          response: { use: mock(() => {}) },
        },
      };

      client = new Devento({
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

        expect(mockHttpClient.post).toHaveBeenCalledWith("/api/v2/boxes", {});
        expect(boxHandle.id).toBe("box-123");
      });

      it("should create a box with custom config", async () => {
        mockHttpClient.post.mockResolvedValue({
          data: { id: "box-123" },
        });

        const boxHandle = await client.createBox({
          cpu: 2,
          mib_ram: 2048,
          timeout: 600,
          metadata: { purpose: "testing" },
        });

        expect(mockHttpClient.post).toHaveBeenCalledWith("/api/v2/boxes", {
          cpu: 2,
          mib_ram: 2048,
          timeout: 600,
          metadata: { purpose: "testing" },
        });
        expect(boxHandle.id).toBe("box-123");
      });

      it("should create a box with watermark_enabled", async () => {
        mockHttpClient.post.mockResolvedValue({
          data: { id: "box-123" },
        });

        const boxHandle = await client.createBox({
          watermark_enabled: false,
        });

        expect(mockHttpClient.post).toHaveBeenCalledWith("/api/v2/boxes", {
          watermark_enabled: false,
        });
        expect(boxHandle.id).toBe("box-123");
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
                data: {
                    id: "box-123",
                    status: BoxState.RUNNING,
                    timeout: 600,
                    created_at: new Date().toISOString(),
                  },
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
                data: {
                    id: "box-123",
                    status: BoxState.RUNNING,
                    timeout: 300,
                    created_at: new Date().toISOString(),
                  },
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
                data: {
                    id: "box-123",
                    status: BoxState.RUNNING,
                    timeout: 600,
                    created_at: new Date().toISOString(),
                  },
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
                data: {
                    id: "box-123",
                    status: BoxState.RUNNING,
                    timeout: 600,
                    created_at: new Date().toISOString(),
                  },
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
        process.env.DEVENTO_BOX_TIMEOUT = "300";

        mockHttpClient.post.mockResolvedValue({
          data: { id: "box-123" },
        });

        // Mock request method for BoxHandle operations
        mockHttpClient.request.mockImplementation((config) => {
          if (config.method === "GET" && config.url.includes("/api/v2/boxes")) {
            return Promise.resolve({
              data: {
                data: {
                    id: "box-123",
                    status: BoxState.RUNNING,
                    timeout: 300,
                    created_at: new Date().toISOString(),
                  },
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
          timeout: 300,
        });

        // Clean up
        delete process.env.DEVENTO_BOX_TIMEOUT;
      });
    });

    describe("Domains API", () => {
      const mockDomainResponse = {
        data: {
          id: "dom_123",
          hostname: "app.deven.to",
          slug: "app",
          kind: DomainKind.MANAGED,
          status: DomainStatus.ACTIVE,
          target_port: 4000,
          box_id: "box_123",
          cloudflare_id: null,
          verification_payload: {},
          verification_errors: {},
          inserted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        meta: {
          managed_suffix: "deven.to",
          cname_target: "edge.deven.to",
        },
      };

      it("should list domains with meta", async () => {
        mockHttpClient.get.mockResolvedValue({
          data: mockDomainResponse,
        });

        const result = await client.listDomains();

        expect(mockHttpClient.get).toHaveBeenCalledWith("/api/v2/domains");
        expect(result).toEqual(mockDomainResponse);
      });

      it("should get a domain by id", async () => {
        mockHttpClient.get.mockResolvedValue({
          data: mockDomainResponse,
        });

        const result = await client.getDomain("dom_123");

        expect(mockHttpClient.get).toHaveBeenCalledWith(
          "/api/v2/domains/dom_123",
        );
        expect(result.data.id).toBe("dom_123");
      });

      it("should create a managed domain and omit undefined fields", async () => {
        mockHttpClient.post.mockResolvedValue({
          data: mockDomainResponse,
        });

        const payload = {
          kind: DomainKind.MANAGED,
          slug: "app",
          hostname: undefined,
          target_port: 4000,
          box_id: "box_123",
        } satisfies CreateDomainRequest;

        const result = await client.createDomain(payload);

        expect(mockHttpClient.post).toHaveBeenCalledWith(
          "/api/v2/domains",
          expect.objectContaining({
            kind: DomainKind.MANAGED,
            slug: "app",
            target_port: 4000,
            box_id: "box_123",
          }),
        );

        const [, body] = mockHttpClient.post.mock.calls[0];
        expect("hostname" in body).toBe(false);
        expect(result.data.kind).toBe(DomainKind.MANAGED);
      });

      it("should update a domain", async () => {
        mockHttpClient.patch.mockResolvedValue({
          data: mockDomainResponse,
        });

        const result = await client.updateDomain("dom_123", {
          status: DomainStatus.ACTIVE,
          target_port: null,
          box_id: null,
        });

        expect(mockHttpClient.patch).toHaveBeenCalledWith(
          "/api/v2/domains/dom_123",
          expect.objectContaining({
            status: DomainStatus.ACTIVE,
            target_port: null,
            box_id: null,
          }),
        );
        expect(result.data.id).toBe("dom_123");
      });

      it("should delete a domain", async () => {
        mockHttpClient.delete.mockResolvedValue({ data: {} });

        await client.deleteDomain("dom_123");

        expect(mockHttpClient.delete).toHaveBeenCalledWith(
          "/api/v2/domains/dom_123",
        );
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

      new Devento({
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

});
