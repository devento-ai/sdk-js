import {
  Box,
  BoxState,
  Command,
  CommandState,
  CommandOptions,
  CommandResult,
  QueueCommandRequest,
  SSEOutputData,
  SSEStatusData,
  SSEEndData,
  SSEErrorData,
  ExposedPort,
} from "./models";
import {
  BoxTimeoutError,
  CommandTimeoutError,
  BoxNotFoundError,
} from "./exceptions";
import { parseSSEStream } from "./sse-utils";

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
    const useStreaming = !!(onStdout || onStderr);

    if (useStreaming) {
      return this.runWithStreaming(command, options);
    }

    const response = await this.makeRequest<{ id: string }>(
      "POST",
      `/api/v2/boxes/${this._id}`,
      { command } as QueueCommandRequest,
    );

    const commandId = response.id;
    const startTime = Date.now();

    // Poll for completion without streaming
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const cmd = await this.makeRequest<Command>(
        "GET",
        `/api/v2/boxes/${this._id}/commands/${commandId}`,
      );

      if (
        [CommandState.DONE, CommandState.FAILED, CommandState.ERROR].includes(
          cmd.status,
        )
      ) {
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

  private async runWithStreaming(
    command: string,
    options?: CommandOptions,
  ): Promise<CommandResult> {
    const timeout = options?.timeout;
    const onStdout = options?.onStdout;
    const onStderr = options?.onStderr;

    const url = `${this.config.baseUrl}/api/v2/boxes/${this._id}`;
    const headers = {
      "x-api-key": this.config.apiKey,
      "Content-Type": "application/json",
    };

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let exitCode = 0;
      let state: CommandState = CommandState.QUEUED;
      let buffer = "";

      this.config.httpClient
        .request({
          method: "POST",
          url,
          headers,
          data: { command, stream: true } as QueueCommandRequest,
          responseType: "stream",
          timeout: 0, // Disable axios timeout for streaming
        })
        .then((response) => {
          const stream = response.data;

          stream.on("data", (chunk: Buffer) => {
            buffer += chunk.toString();
            const messages = buffer.split("\n\n");
            buffer = messages.pop() || "";

            for (const message of messages) {
              if (!message.trim()) continue;

              for (const sseEvent of parseSSEStream(message + "\n\n")) {
                try {
                  const data = JSON.parse(sseEvent.data);

                  switch (sseEvent.event) {
                    case "output": {
                      const outputData = data as SSEOutputData;
                      if (outputData.stdout) {
                        stdout += outputData.stdout;
                        if (onStdout) {
                          const lines = outputData.stdout.split("\n");
                          lines.forEach((line, index) => {
                            if (index < lines.length - 1 || line) {
                              onStdout(line);
                            }
                          });
                        }
                      }
                      if (outputData.stderr) {
                        stderr += outputData.stderr;
                        if (onStderr) {
                          const lines = outputData.stderr.split("\n");
                          lines.forEach((line, index) => {
                            if (index < lines.length - 1 || line) {
                              onStderr(line);
                            }
                          });
                        }
                      }
                      break;
                    }

                    case "status": {
                      const statusData = data as SSEStatusData;
                      state = statusData.status as CommandState;
                      if (statusData.exit_code !== undefined) {
                        exitCode = statusData.exit_code;
                      }
                      break;
                    }

                    case "end": {
                      const endData = data as SSEEndData;
                      if (endData.status === "error") {
                        state = CommandState.ERROR;
                      } else if (endData.status === "timeout") {
                        reject(new CommandTimeoutError("", timeout || 30000));
                        return;
                      }
                      stream.destroy();
                      resolve({ stdout, stderr, exitCode, state });
                      return;
                    }

                    case "error": {
                      const errorData = data as SSEErrorData;
                      reject(new Error(errorData.error));
                      stream.destroy();
                      return;
                    }

                    case "timeout": {
                      reject(new CommandTimeoutError("", timeout || 30000));
                      stream.destroy();
                      return;
                    }
                  }
                } catch (e) {
                  // Ignore JSON parse errors
                }
              }
            }

            // Check for client-side timeout
            if (timeout && Date.now() - startTime > timeout) {
              reject(new CommandTimeoutError("", timeout));
              stream.destroy();
            }
          });

          stream.on("error", (error: Error) => {
            reject(error);
          });

          stream.on("end", () => {
            // If stream ends without proper completion, resolve with current state
            resolve({ stdout, stderr, exitCode, state });
          });
        })
        .catch(reject);
    });
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

  /**
   * Exposes a port from inside the sandbox to a random external port.
   * This allows external access to services running inside the sandbox.
   *
   * @param targetPort - The port number inside the sandbox to expose
   * @returns Promise<ExposedPort> - Contains the proxy_port (external), target_port, and expires_at
   * @throws Error if the box is not in a running state or if no ports are available
   *
   * @example
   * ```typescript
   * // Start a web server on port 3000 inside the sandbox
   * await box.run("python -m http.server 3000 &");
   *
   * // Expose port 3000 to the outside
   * const exposed = await box.exposePort(3000);
   * console.log(`Access your service at port ${exposed.proxy_port}`);
   * ```
   */
  async exposePort(targetPort: number): Promise<ExposedPort> {
    const response = await this.makeRequest<{ data: ExposedPort }>(
      "POST",
      `/api/v2/boxes/${this._id}/expose_port`,
      { port: targetPort },
    );
    return response.data;
  }
}
