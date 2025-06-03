import { Tavor } from "../src";

async function main() {
  // Initialize the Tavor client
  const tavor = new Tavor({
    apiKey: "your-api-key", // or use TAVOR_API_KEY env var
  });

  // Example 1: Using withSandbox for automatic cleanup
  console.log("Example 1: Auto-managed sandbox");
  await tavor.withSandbox(async (box) => {
    console.log(`Box ${box.id} is ready!`);

    // Run a simple command
    const result = await box.run('echo "Hello from Tavor!"');
    console.log("Output:", result.stdout);
    console.log("Exit code:", result.exitCode);
  });

  // Example 2: Manual sandbox management with custom resources
  console.log("\nExample 2: Manually managed sandbox with custom CPU and RAM");
  const box = await tavor.createBox({
    cpu: 2,
    mib_ram: 2048, // 2 GB RAM
    metadata: { purpose: "testing" },
  });

  try {
    await box.waitUntilReady();
    console.log(`Box ${box.id} is ready!`);

    // Run multiple commands
    const result1 = await box.run("pwd");
    console.log("Current directory:", result1.stdout.trim());

    const result2 = await box.run("ls -la");
    console.log("Directory contents:", result2.stdout);
  } finally {
    // Always clean up
    await box.stop();
    console.log("Box stopped");
  }
}

// Run the example
main().catch(console.error);

