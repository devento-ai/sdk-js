import { Devento } from "../src";

async function main() {
  const client = new Devento({
    apiKey: process.env.DEVENTO_API_KEY,
  });

  console.log("Creating a new sandbox...");
  const box = await client.createBox();

  try {
    console.log("Waiting for sandbox to be ready...");
    await box.waitUntilReady();

    console.log("Starting a simple HTTP server on port 3000...");
    box.run(`
      cat > server.js << 'EOF'
      const http = require('http');
      const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Hello from Devento sandbox!\\n');
      });
      server.listen(3000, () => {
        console.log('Server running on port 3000');
      });
      EOF

      node server.js &
    `);

    // Give the server a moment to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("Exposing port 3000...");
    const exposedPort = await box.exposePort(3000);

    console.log(`Port exposed successfully!`);
    console.log(`  Target port: ${exposedPort.target_port}`);
    console.log(`  Proxy port: ${exposedPort.proxy_port}`);
    console.log(`  Expires at: ${exposedPort.expires_at}`);

    // You can now access your service from outside the sandbox
    // using the proxy_port on the sandbox's hostname

    console.log("\nKeeping sandbox alive for 30 seconds...");
    console.log("You can test the exposed port during this time.");
    await new Promise((resolve) => setTimeout(resolve, 30000));
  } finally {
    console.log("Stopping sandbox...");
    await box.stop();
    console.log("Done!");
  }
}

main().catch(console.error);
