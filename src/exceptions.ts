export class DeventoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeventoError";
    Object.setPrototypeOf(this, DeventoError.prototype);
  }
}

export class APIError extends DeventoError {
  public statusCode: number;
  public responseData?: unknown;

  constructor(message: string, statusCode: number, responseData?: unknown) {
    super(message);
    this.name = "APIError";
    this.statusCode = statusCode;
    this.responseData = responseData;
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

export class AuthenticationError extends APIError {
  constructor(
    message: string = "Authentication failed",
    responseData?: unknown,
  ) {
    super(message, 401, responseData);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class ForbiddenError extends APIError {
  constructor(message: string = "Access forbidden", responseData?: unknown) {
    super(message, 403, responseData);
    this.name = "ForbiddenError";
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class NotFoundError extends APIError {
  constructor(message: string = "Resource not found", responseData?: unknown) {
    super(message, 404, responseData);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class BoxNotFoundError extends NotFoundError {
  constructor(boxId: string, responseData?: unknown) {
    super(`Box with ID ${boxId} not found`, responseData);
    this.name = "BoxNotFoundError";
    Object.setPrototypeOf(this, BoxNotFoundError.prototype);
  }
}

export class ConflictError extends APIError {
  constructor(message: string = "Resource conflict", responseData?: unknown) {
    super(message, 409, responseData);
    this.name = "ConflictError";
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class ValidationError extends APIError {
  constructor(message: string = "Validation error", responseData?: unknown) {
    super(message, 422, responseData);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ServerError extends APIError {
  constructor(
    message: string = "Internal server error",
    statusCode: number = 500,
    responseData?: unknown,
  ) {
    super(message, statusCode, responseData);
    this.name = "ServerError";
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

export class CommandTimeoutError extends DeventoError {
  constructor(commandId: string, timeout: number) {
    super(`Command ${commandId} timed out after ${timeout}ms`);
    this.name = "CommandTimeoutError";
    Object.setPrototypeOf(this, CommandTimeoutError.prototype);
  }
}

export class BoxTimeoutError extends DeventoError {
  constructor(boxId: string, timeout: number) {
    super(`Box ${boxId} failed to become ready within ${timeout}ms`);
    this.name = "BoxTimeoutError";
    Object.setPrototypeOf(this, BoxTimeoutError.prototype);
  }
}

export function mapHttpErrorToException(
  statusCode: number,
  message: string,
  responseData?: unknown,
): APIError {
  switch (statusCode) {
    case 401:
      return new AuthenticationError(message, responseData);
    case 403:
      return new ForbiddenError(message, responseData);
    case 404:
      return new NotFoundError(message, responseData);
    case 409:
      return new ConflictError(message, responseData);
    case 422:
      return new ValidationError(message, responseData);
    default:
      if (statusCode >= 500) {
        return new ServerError(message, statusCode, responseData);
      }
      return new APIError(message, statusCode, responseData);
  }
}
