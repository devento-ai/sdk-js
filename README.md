# Tavor JavaScript/TypeScript SDK

Official JavaScript/TypeScript SDK for the Tavor cloud sandbox platform.

## Installation

```bash
bun add @tavor/sdk
# or
npm install @tavor/sdk
# or
yarn add @tavor/sdk
```

## Quick Start

```typescript
import { Tavor } from "@tavor/sdk";

const tavor = new Tavor({
  apiKey: "your-api-key", // or use TAVOR_API_KEY env var
});

// Automatic sandbox management
await tavor.withSandbox(async (box) => {
  const result = await box.run('echo "Hello from Tavor!"');
  console.log(result.stdout);
});
```

## Configuration

The Tavor client can be configured through constructor options or environment variables:

```typescript
const tavor = new Tavor({
  apiKey: "sk-tavor-...", // Required: Your API key
  baseUrl: "https://api.tavor.dev", // Optional: API base URL
  timeout: 30000, // Optional: Request timeout in ms
});
```

Environment variables:

- `TAVOR_API_KEY` - Your Tavor API key
- `TAVOR_BASE_URL` - API base URL (defaults to <https://api.tavor.dev>)
- `TAVOR_BOX_TIMEOUT` - Default box timeout in seconds (for withSandbox)

## Usage

### Automatic Sandbox Management

The recommended way to use Tavor is with the `withSandbox` method, which automatically handles cleanup:

```typescript
await tavor.withSandbox(
  async (box) => {
    // Your code here
    const result = await box.run("npm install && npm test");
    console.log(result.stdout);
  },
  {
    cpu: 4,
    mib_ram: 4096, // 4 GB RAM
    timeout: 600, // seconds
    metadata: { project: "my-app" },
  },
);
```

### Manual Sandbox Management

For more control, you can manually manage sandbox lifecycle:

```typescript
const box = await tavor.createBox({
  cpu: 2,
  mib_ram: 2048, // 2 GB RAM
});

try {
  await box.waitUntilReady();

  const result = await box.run("ls -la");
  console.log(result.stdout);
} finally {
  await box.stop();
}
```

### Streaming Output

Get real-time command output with streaming:

```typescript
await box.run("npm install", {
  onStdout: (line) => console.log(`[OUT] ${line}`),
  onStderr: (line) => console.error(`[ERR] ${line}`),
  timeout: 300000, // 5 minutes
});
```

### Box Resources

You can specify custom CPU and RAM for your sandboxes:

- `cpu` - Number of CPU cores (e.g., 1, 2, 4)
- `mib_ram` - RAM in MiB (e.g., 1024 for 1GB, 2048 for 2GB)

If not specified, the backend defaults to 1 CPU and 1GB RAM.

### Error Handling

The SDK provides typed exceptions for different error scenarios:

```typescript
import {
  TavorError,
  AuthenticationError,
  BoxTimeoutError,
  CommandTimeoutError,
} from "@tavor/sdk";

try {
  await tavor.withSandbox(async (box) => {
    await box.run("long-running-command", { timeout: 5000 });
  });
} catch (error) {
  if (error instanceof CommandTimeoutError) {
    console.error("Command timed out");
  } else if (error instanceof BoxTimeoutError) {
    console.error("Box failed to start");
  } else if (error instanceof AuthenticationError) {
    console.error("Invalid API key");
  }
}
```

## API Reference

### Tavor Client

#### `new Tavor(config?: TavorConfig)`

Creates a new Tavor client instance.

#### `tavor.withSandbox<T>(callback, config?): Promise<T>`

Creates a sandbox, runs the callback, and automatically cleans up.

#### `tavor.createBox(config?): Promise<BoxHandle>`

Creates a new sandbox and returns a handle for manual management.

#### `tavor.listBoxes(): Promise<Box[]>`

Lists all boxes in your organization.

#### `tavor.getBox(boxId): Promise<BoxHandle>`

Gets an existing box by ID.

### BoxHandle

#### `box.run(command, options?): Promise<CommandResult>`

Executes a command in the sandbox.

#### `box.waitUntilReady(timeout?): Promise<void>`

Waits for the sandbox to be ready.

#### `box.stop(): Promise<void>`

Stops the sandbox.

#### `box.refresh(): Promise<void>`

Refreshes the box state from the API.

## Examples

See the [examples](examples/) directory for more detailed usage examples:

- [Basic usage](examples/example-basic.ts)
- [Streaming output](examples/example-streaming.ts)
- [Advanced patterns](examples/example-advanced.ts)

## License

MIT
