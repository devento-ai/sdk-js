export enum BoxState {
  CREATING = "creating",
  QUEUED = "queued",
  PROVISIONING = "provisioning",
  BOOTING = "booting",
  RUNNING = "running",
  PAUSED = "paused",
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

export enum DomainKind {
  MANAGED = "managed",
  CUSTOM = "custom",
}

export enum DomainStatus {
  PENDING_DNS = "pending_dns",
  PENDING_SSL = "pending_ssl",
  ACTIVE = "active",
  FAILED = "failed",
  DISABLED = "disabled",
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
  hostname?: string;
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
  stream?: boolean;
  timeout_ms?: number;
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

export interface SSEEvent {
  event: string;
  data: string;
}

export interface SSEStartData {
  command_id: string;
  status: string;
}

export interface SSEOutputData {
  stdout?: string;
  stderr?: string;
}

export interface SSEStatusData {
  status: string;
  exit_code?: number;
}

export interface SSEEndData {
  status: string;
}

export interface SSEErrorData {
  error: string;
}

export interface ExposedPort {
  proxy_port: number;
  target_port: number;
  expires_at: string;
}

export type SnapshotStatus =
  | "creating"
  | "ready"
  | "restoring"
  | "deleted"
  | "error";

export interface Snapshot {
  id: string;
  box_id: string;
  snapshot_type: "disk";
  status: SnapshotStatus;
  label?: string;
  size_bytes?: number;
  checksum_sha256?: string;
  created_at: string;
  orchestrator_id: string;
  description?: string;
}

export interface Domain {
  id: string;
  hostname: string;
  slug: string | null;
  kind: DomainKind;
  status: DomainStatus;
  target_port: number | null;
  box_id: string | null;
  cloudflare_id: string | null;
  verification_payload: Record<string, unknown> | null;
  verification_errors: Record<string, unknown> | null;
  inserted_at: string;
  updated_at: string;
}

export interface DomainMeta {
  managed_suffix: string;
  cname_target: string;
}

export interface DomainsResponse {
  data: Domain[];
  meta: DomainMeta;
}

export interface DomainResponse {
  data: Domain;
  meta: DomainMeta;
}

export interface CreateDomainRequest {
  kind: DomainKind | `${DomainKind}`;
  slug?: string;
  hostname?: string;
  status?: DomainStatus | `${DomainStatus}`;
  target_port?: number;
  box_id?: string;
}

export interface UpdateDomainRequest {
  slug?: string | null;
  hostname?: string | null;
  status?: DomainStatus | `${DomainStatus}`;
  target_port?: number | null;
  box_id?: string | null;
}
