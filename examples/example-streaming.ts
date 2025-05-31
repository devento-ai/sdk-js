import { Tavor, BoxTemplate } from "../src";

async function main() {
  const tavor = new Tavor({
    apiKey: process.env.TAVOR_API_KEY,
  });

  // Example: Streaming command output in real-time
  await tavor.withSandbox(
    async (box) => {
      console.log(`Box ${box.id} is ready!`);

      // Run a command with streaming output
      console.log("Running command with streaming output...\n");

      const result = await box.run(
        'for i in {1..5}; do echo "Processing item $i..."; sleep 1; done',
        {
          onStdout: (line) => {
            console.log(`[STDOUT] ${line}`);
          },
          onStderr: (line) => {
            console.error(`[STDERR] ${line}`);
          },
        },
      );

      console.log("\nCommand completed!");
      console.log("Exit code:", result.exitCode);
    },
    {
      template: BoxTemplate.BASIC,
    },
  );

  // Example with error handling
  await tavor.withSandbox(async (box) => {
    console.log("\nRunning command that produces errors...");

    const result = await box.run(
      'echo "This is stdout"; >&2 echo "This is stderr"; exit 1',
      {
        onStdout: (line) => {
          console.log(`[OUT] ${line}`);
        },
        onStderr: (line) => {
          console.error(`[ERR] ${line}`);
        },
      },
    );

    console.log("Exit code:", result.exitCode);
    console.log("Command state:", result.state);
  });
}

main().catch(console.error);

