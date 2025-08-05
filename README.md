# Devento JavaScript/TypeScript SDK

Official JavaScript/TypeScript SDK for the Devento cloud sandbox platform.

## Installation

```bash
bun add @devento/sdk
# or
npm install @devento/sdk
# or
yarn add @devento/sdk
```

## Quick Start

```typescript
import { Devento } from "@devento/sdk";

const devento = new Devento({
  apiKey: "your-api-key", // or use DEVENTO_API_KEY env var
});

// Automatic sandbox management
await devento.withSandbox(async (box) => {
  const result = await box.run('echo "Hello from Devento!"');
  console.log(result.stdout);
});
```

## Configuration

The Devento client can be configured through constructor options or environment variables:

```typescript
const devento = new Devento({
  apiKey: "sk-devento-...", // Required: Your API key
  baseUrl: "https://api.devento.ai", // Optional: API base URL
  timeout: 30000, // Optional: Request timeout in ms
});
```

Environment variables:

- `DEVENTO_API_KEY` - Your Devento API key
- `DEVENTO_BASE_URL` - API base URL (defaults to <https://api.devento.ai>)
- `DEVENTO_BOX_TIMEOUT` - Default box timeout in seconds (for withSandbox)

## Usage

### Automatic Sandbox Management

The recommended way to use Devento is with the `withSandbox` method, which automatically handles cleanup:

```typescript
await devento.withSandbox(
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
const box = await devento.createBox({
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

### Web Access

Devento boxes can expose services to the internet. Each box gets a unique hostname like `uuid.deven.to`. To access a service running on a specific port inside the VM:

```typescript
const box = await devento.createBox();
await box.waitUntilReady();

// Start a web server on port 3000
await box.run("npx http-server -p 3000", {
  onStdout: (line) => console.log(line),
});

// Get the public URL for port 3000
const publicUrl = box.getPublicUrl(3000);
console.log(`Service available at: ${publicUrl}`);
// Output: https://3000-uuid.deven.to
```

The URL pattern is `https://{port}-{hostname}` where:

- `port` is the port number inside the VM
- `hostname` is the unique hostname assigned to the box

### Port Exposing

You can dynamically expose ports from inside the sandbox to random external ports. This is useful when you need to access services running inside the sandbox but don't know the port in advance or need multiple services:

```typescript
const box = await devento.createBox();
await box.waitUntilReady();

// Start a service on port 3000 inside the sandbox
await box.run("python -m http.server 3000 &");

// Expose the internal port 3000 to an external port
const exposedPort = await box.exposePort(3000);

console.log(
  `Internal port ${exposedPort.target_port} is now accessible on external port ${exposedPort.proxy_port}`,
);
console.log(`Port mapping expires at: ${exposedPort.expires_at}`);

// You can now access the service using the proxy_port
// For example: http://sandbox-hostname:proxy_port
```

The `exposePort` method returns an `ExposedPort` object with:

- `target_port` - The port inside the sandbox (what you requested)
- `proxy_port` - The external port assigned by the system
- `expires_at` - When this port mapping will expire

### Error Handling

The SDK provides typed exceptions for different error scenarios:

```typescript
import {
  DeventoError,
  AuthenticationError,
  BoxTimeoutError,
  CommandTimeoutError,
} from "@devento/sdk";

try {
  await devento.withSandbox(async (box) => {
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

### Devento Client

#### `new Devento(config?: DeventoConfig)`

Creates a new Devento client instance.

#### `devento.withSandbox<T>(callback, config?): Promise<T>`

Creates a sandbox, runs the callback, and automatically cleans up.

#### `devento.createBox(config?): Promise<BoxHandle>`

Creates a new sandbox and returns a handle for manual management.

#### `devento.listBoxes(): Promise<Box[]>`

Lists all boxes in your organization.

#### `devento.getBox(boxId): Promise<BoxHandle>`

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

#### `box.getPublicUrl(port): string`

Returns the public URL for accessing a service on the specified port.

#### `box.exposePort(targetPort): Promise<ExposedPort>`

Exposes a port from inside the sandbox to a random external port. Returns an object containing the proxy port, target port, and expiration time.

## Examples

See the [examples](examples/) directory for more detailed usage examples:

- [Basic usage](examples/example-basic.ts)
- [Streaming output](examples/example-streaming.ts)
- [Advanced patterns](examples/example-advanced.ts)
- [Web services](examples/example-web.ts)
- [Exposing ports](examples/example-expose-port.ts)

## License

MIT
