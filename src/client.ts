import axios, { AxiosInstance, AxiosError } from "axios";
import {
  Box,
  BoxConfig,
  CreateBoxRequest,
  DomainsResponse,
  DomainResponse,
  CreateDomainRequest,
  UpdateDomainRequest,
} from "./models";
import {
  mapHttpErrorToException,
  DeventoError,
  AuthenticationError,
} from "./exceptions";
import { BoxHandle } from "./box-handle";

export interface DeventoConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  httpClient?: AxiosInstance;
}

export class Devento {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number; // HTTP request timeout in milliseconds
  private httpClient: AxiosInstance;

  constructor(config?: DeventoConfig) {
    this.apiKey = config?.apiKey || process.env.DEVENTO_API_KEY || "";
    this.baseUrl =
      config?.baseUrl || process.env.DEVENTO_BASE_URL || "https://api.devento.ai";
    this.timeout = config?.timeout || 30000;

    if (!this.apiKey) {
      throw new AuthenticationError(
        "API key is required. Set it via config or DEVENTO_API_KEY environment variable.",
      );
    }

    this.httpClient =
      config?.httpClient ||
      axios.create({
        baseURL: this.baseUrl,
        timeout: this.timeout,
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
      });

    this.httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const { status, data } = error.response;
          const message =
            (data as Record<string, unknown>)?.error || error.message;
          throw mapHttpErrorToException(status, message as string, data);
        } else if (error.request) {
          throw new DeventoError(`Request failed: ${error.message}`);
        } else {
          throw new DeventoError(`Error: ${error.message}`);
        }
      },
    );
  }

  private removeUndefinedFromObject<T extends object>(
    payload: T,
  ): Record<string, unknown> {
    return Object.entries(payload as Record<string, unknown>).reduce(
      (acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, unknown>,
    );
  }

  async createBox(config?: BoxConfig): Promise<BoxHandle> {
    const request: CreateBoxRequest = {};

    if (config?.timeout !== undefined) {
      request.timeout = config.timeout;
    }
    if (config?.metadata) {
      request.metadata = config.metadata;
    }
    if (config?.cpu !== undefined) {
      request.cpu = config.cpu;
    }
    if (config?.mib_ram !== undefined) {
      request.mib_ram = config.mib_ram;
    }

    const response = await this.httpClient.post<{ id: string }>(
      "/api/v2/boxes",
      request,
    );

    return new BoxHandle(response.data.id, {
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      httpClient: this.httpClient,
      timeout: this.timeout,
    });
  }

  async listBoxes(): Promise<Box[]> {
    const response = await this.httpClient.get<{ data: Box[] }>(
      "/api/v2/boxes",
    );
    return response.data.data;
  }

  async getBox(boxId: string): Promise<BoxHandle> {
    return new BoxHandle(boxId, {
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      httpClient: this.httpClient,
      timeout: this.timeout,
    });
  }

  async listDomains(): Promise<DomainsResponse> {
    const response =
      await this.httpClient.get<DomainsResponse>("/api/v2/domains");
    return response.data;
  }

  async getDomain(domainId: string): Promise<DomainResponse> {
    const response = await this.httpClient.get<DomainResponse>(
      `/api/v2/domains/${domainId}`,
    );
    return response.data;
  }

  async createDomain(
    payload: CreateDomainRequest,
  ): Promise<DomainResponse> {
    const cleanPayload = this.removeUndefinedFromObject(payload);
    const response = await this.httpClient.post<DomainResponse>(
      "/api/v2/domains",
      cleanPayload,
    );
    return response.data;
  }

  async updateDomain(
    domainId: string,
    payload: UpdateDomainRequest,
  ): Promise<DomainResponse> {
    const cleanPayload = this.removeUndefinedFromObject(payload);
    const response = await this.httpClient.patch<DomainResponse>(
      `/api/v2/domains/${domainId}`,
      cleanPayload,
    );
    return response.data;
  }

  async deleteDomain(domainId: string): Promise<void> {
    await this.httpClient.delete(`/api/v2/domains/${domainId}`);
  }

  async withSandbox<T>(
    callback: (box: BoxHandle) => Promise<T>,
    config?: BoxConfig,
  ): Promise<T> {
    const boxTimeout =
      config?.timeout || parseInt(process.env.DEVENTO_BOX_TIMEOUT || "600");
    const boxConfig = { ...config, timeout: boxTimeout };

    const box = await this.createBox(boxConfig);

    try {
      await box.waitUntilReady();
      const result = await callback(box);
      return result;
    } finally {
      try {
        await box.stop();
      } catch (error) {
        console.error(`Failed to stop box ${box.id}:`, error);
      }
    }
  }
}
