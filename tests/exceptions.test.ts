import { describe, expect, it } from "bun:test";
import {
  DeventoError,
  APIError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  BoxNotFoundError,
  ConflictError,
  ValidationError,
  ServerError,
  CommandTimeoutError,
  BoxTimeoutError,
  mapHttpErrorToException,
} from "../src/exceptions";

describe("Exceptions", () => {
  describe("DeventoError", () => {
    it("should create error with message", () => {
      const error = new DeventoError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.name).toBe("DeventoError");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("APIError", () => {
    it("should create error with status code and response data", () => {
      const error = new APIError("API error", 400, { detail: "Bad request" });
      expect(error.message).toBe("API error");
      expect(error.statusCode).toBe(400);
      expect(error.responseData).toEqual({ detail: "Bad request" });
      expect(error).toBeInstanceOf(DeventoError);
    });
  });

  describe("Specific error types", () => {
    it("AuthenticationError should have 401 status", () => {
      const error = new AuthenticationError();
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe("Authentication failed");
    });

    it("ForbiddenError should have 403 status", () => {
      const error = new ForbiddenError();
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe("Access forbidden");
    });

    it("NotFoundError should have 404 status", () => {
      const error = new NotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe("Resource not found");
    });

    it("BoxNotFoundError should include box ID", () => {
      const error = new BoxNotFoundError("box-123");
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe("Box with ID box-123 not found");
    });

    it("ConflictError should have 409 status", () => {
      const error = new ConflictError();
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe("Resource conflict");
    });

    it("ValidationError should have 422 status", () => {
      const error = new ValidationError();
      expect(error.statusCode).toBe(422);
      expect(error.message).toBe("Validation error");
    });

    it("ServerError should have 500+ status", () => {
      const error = new ServerError("Server error", 503);
      expect(error.statusCode).toBe(503);
      expect(error.message).toBe("Server error");
    });
  });

  describe("Timeout errors", () => {
    it("CommandTimeoutError should include command ID and timeout", () => {
      const error = new CommandTimeoutError("cmd-123", 5000);
      expect(error.message).toBe("Command cmd-123 timed out after 5000ms");
    });

    it("BoxTimeoutError should include box ID and timeout", () => {
      const error = new BoxTimeoutError("box-123", 60000);
      expect(error.message).toBe(
        "Box box-123 failed to become ready within 60000ms",
      );
    });
  });

  describe("mapHttpErrorToException", () => {
    it("should map 401 to AuthenticationError", () => {
      const error = mapHttpErrorToException(401, "Unauthorized");
      expect(error).toBeInstanceOf(AuthenticationError);
    });

    it("should map 403 to ForbiddenError", () => {
      const error = mapHttpErrorToException(403, "Forbidden");
      expect(error).toBeInstanceOf(ForbiddenError);
    });

    it("should map 404 to NotFoundError", () => {
      const error = mapHttpErrorToException(404, "Not found");
      expect(error).toBeInstanceOf(NotFoundError);
    });

    it("should map 409 to ConflictError", () => {
      const error = mapHttpErrorToException(409, "Conflict");
      expect(error).toBeInstanceOf(ConflictError);
    });

    it("should map 422 to ValidationError", () => {
      const error = mapHttpErrorToException(422, "Validation failed");
      expect(error).toBeInstanceOf(ValidationError);
    });

    it("should map 500+ to ServerError", () => {
      const error = mapHttpErrorToException(502, "Bad gateway");
      expect(error).toBeInstanceOf(ServerError);
    });

    it("should map unknown status to generic APIError", () => {
      const error = mapHttpErrorToException(418, "I'm a teapot");
      expect(error).toBeInstanceOf(APIError);
      expect(error.statusCode).toBe(418);
    });
  });
});

