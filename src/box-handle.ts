import {
  Box,
  BoxState,
  Command,
  CommandState,
  CommandOptions,
  CommandResult,
  QueueCommandRequest,
} from "./models";
import {
  BoxTimeoutError,
  CommandTimeoutError,
  BoxNotFoundError,
} from "./exceptions";

import { AxiosInstance } from "axios";

export interface BoxHandleConfig {
  apiKey: string;
  baseUrl: string;
  httpClient: AxiosInstance;
  timeout?: number;
}

export class BoxHandle {
  private config: BoxHandleConfig;
  private _id: string;
  private _box?: Box;
  private lastStdoutPositions: Map<string, number> = new Map();
  private lastStderrPositions: Map<string, number> = new Map();

  constructor(boxOrId: Box | string, config: BoxHandleConfig) {
    if (typeof boxOrId === "string") {
      this._id = boxOrId;
    } else {
      this._box = boxOrId;
      this._id = boxOrId.id;
    }
    this.config = config;
  }

  get box(): Box | undefined {
    return this._box;
  }

  get id(): string {
    return this._id;
  }

  get state(): BoxState {
    return this._box?.status || BoxState.QUEUED;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this._box?.metadata;
  }

  private async makeRequest<T>(
    method: string,
    path: string,
    data?: unknown,
    config?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const headers = {
      "x-api-key": this.config.apiKey,
      "Content-Type": "application/json",
      ...(config?.headers as Record<string, string> | undefined),
    };

    const response = await this.config.httpClient.request({
      method,
      url,
      headers,
      data,
      timeout: this.config.timeout,
      ...config,
    });
    return response.data as T;
  }

  async refresh(): Promise<void> {
    // TODO: GET /api/v2/boxes/{box_id} instead of list_boxes here
    const response = await this.makeRequest<{ data: Box[] }>(
      "GET",
      "/api/v2/boxes",
    );
    const boxes = response.data;

    for (const box of boxes) {
      if (box.id === this._id) {
        this._box = box;
        return;
      }
    }

    throw new BoxNotFoundError(this._id);
  }

  async waitUntilReady(timeout?: number): Promise<void> {
    const startTime = Date.now();
    const maxTimeout = timeout || 60000;
    const pollInterval = 1000;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      await this.refresh();

      if (!this._box) {
        throw new Error(`Failed to fetch box ${this._id}`);
      }

      if (this._box.status === BoxState.RUNNING) {
        return;
      }

      if (
        [
          BoxState.FAILED,
          BoxState.ERROR,
          BoxState.STOPPED,
          BoxState.FINISHED,
        ].includes(this._box.status)
      ) {
        throw new BoxTimeoutError(this._id, maxTimeout);
      }

      if (Date.now() - startTime > maxTimeout) {
        throw new BoxTimeoutError(this._id, maxTimeout);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  async run(command: string, options?: CommandOptions): Promise<CommandResult> {
    const timeout = options?.timeout;
    const onStdout = options?.onStdout;
    const onStderr = options?.onStderr;
    const pollInterval = options?.pollInterval || 1000;

    const response = await this.makeRequest<{ id: string }>(
      "POST",
      `/api/v2/boxes/${this._id}`,
      { command } as QueueCommandRequest,
    );

    const commandId = response.id;
    this.lastStdoutPositions.set(commandId, 0);
    this.lastStderrPositions.set(commandId, 0);

    const startTime = Date.now();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const cmd = await this.makeRequest<Command>(
        "GET",
        `/api/v2/boxes/${this._id}/commands/${commandId}`,
      );

      if (onStdout && cmd.stdout) {
        const lastPos = this.lastStdoutPositions.get(commandId) || 0;
        const newOutput = cmd.stdout.slice(lastPos);
        if (newOutput) {
          const lines = newOutput.split("\n");
          lines.forEach((line, index) => {
            if (index < lines.length - 1 || line) {
              onStdout(line);
            }
          });
          this.lastStdoutPositions.set(commandId, cmd.stdout.length);
        }
      }

      if (onStderr && cmd.stderr) {
        const lastPos = this.lastStderrPositions.get(commandId) || 0;
        const newOutput = cmd.stderr.slice(lastPos);
        if (newOutput) {
          const lines = newOutput.split("\n");
          lines.forEach((line, index) => {
            if (index < lines.length - 1 || line) {
              onStderr(line);
            }
          });
          this.lastStderrPositions.set(commandId, cmd.stderr.length);
        }
      }

      if (
        [CommandState.DONE, CommandState.FAILED, CommandState.ERROR].includes(
          cmd.status,
        )
      ) {
        this.lastStdoutPositions.delete(commandId);
        this.lastStderrPositions.delete(commandId);

        return {
          stdout: cmd.stdout || "",
          stderr: cmd.stderr || "",
          exitCode: cmd.exit_code || (cmd.status === CommandState.DONE ? 0 : 1),
          state: cmd.status,
        };
      }

      if (timeout && Date.now() - startTime > timeout) {
        throw new CommandTimeoutError(commandId, timeout);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  async stop(): Promise<void> {
    if (
      !this._box ||
      ![
        BoxState.STOPPED,
        BoxState.FINISHED,
        BoxState.FAILED,
        BoxState.ERROR,
      ].includes(this._box.status)
    ) {
      await this.makeRequest("DELETE", `/api/v2/boxes/${this._id}`);
      if (this._box) {
        this._box.status = BoxState.STOPPED;
      }
    }
  }

  getPublicUrl(port: number): string {
    if (!this._box?.hostname) {
      throw new Error(
        "Box does not have a hostname. Ensure the box is created and running.",
      );
    }
    return `https://${port}-${this._box.hostname}`;
  }
}
