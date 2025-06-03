export enum BoxState {
  CREATING = "creating",
  QUEUED = "queued",
  PROVISIONING = "provisioning",
  BOOTING = "booting",
  RUNNING = "running",
  STOPPED = "stopped",
  FAILED = "failed",
  FINISHED = "finished",
  ERROR = "error",
}

export enum CommandState {
  QUEUED = "queued",
  RUNNING = "running",
  DONE = "done",
  FAILED = "failed",
  ERROR = "error",
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  credits: number;
  insertedAt: string;
  updatedAt: string;
}

export interface Box {
  id: string;
  status: BoxState;
  timeout?: number;
  created_at?: string;
  metadata?: Record<string, unknown>;
  details?: string;
  cpu?: number;
  mib_ram?: number;
}

export interface Command {
  id: string;
  status: CommandState;
  command: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  created_at?: string;
  finished_at?: string;
}

export interface CreateBoxRequest {
  timeout?: number;
  metadata?: Record<string, unknown>;
  cpu?: number;
  mib_ram?: number;
}

export interface QueueCommandRequest {
  command: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  state: CommandState;
}

export interface BoxConfig {
  timeout?: number;
  metadata?: Record<string, unknown>;
  cpu?: number;
  mib_ram?: number;
}

export interface CommandOptions {
  timeout?: number;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
  pollInterval?: number;
}
