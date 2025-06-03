import { Tavor, TavorError, CommandTimeoutError } from "../src";

async function buildProject() {
  const tavor = new Tavor();

  try {
    await tavor.withSandbox(
      async (box) => {
        console.log(`Starting build in box ${box.id}`);

        // Install dependencies
        console.log("\nInstalling dependencies...");
        await box.run("npm install", {
          timeout: 300000, // 5 minutes
          onStdout: (line) => console.log(`  ${line}`),
        });

        // Run tests
        console.log("\nRunning tests...");
        const testResult = await box.run("npm test", {
          timeout: 120000, // 2 minutes
          onStdout: (line) => console.log(`  ${line}`),
          onStderr: (line) => console.error(`  ERROR: ${line}`),
        });

        if (testResult.exitCode !== 0) {
          throw new Error(`Tests failed with exit code ${testResult.exitCode}`);
        }

        // Build the project
        console.log("\nBuilding project...");
        await box.run("npm run build", {
          onStdout: (line) => console.log(`  ${line}`),
        });

        console.log("\nBuild completed successfully!");
      },
      {
        cpu: 4, // More resources for building
        mib_ram: 4096, // 4 GB RAM
        timeout: 600, // 10 minute box lifetime
        metadata: {
          project: "my-app",
          environment: "ci",
        },
      },
    );
  } catch (error) {
    if (error instanceof CommandTimeoutError) {
      console.error("Command timed out:", error.message);
    } else if (error instanceof TavorError) {
      console.error("Tavor error:", error.message);
    } else {
      console.error("Unexpected error:", error);
    }
    process.exit(1);
  }
}

async function runParallelTasks() {
  const tavor = new Tavor();

  // Run multiple sandboxes in parallel
  const tasks = ["task1", "task2", "task3"].map(async (taskName) => {
    return tavor.withSandbox(
      async (box) => {
        console.log(`[${taskName}] Starting in box ${box.id}`);

        const result = await box.run(`echo "Running ${taskName}"`, {
          onStdout: (line) => console.log(`[${taskName}] ${line}`),
        });

        return { taskName, boxId: box.id, output: result.stdout };
      },
      {
        cpu: 1,
        mib_ram: 1024, // 1 GB RAM (default)
      },
    );
  });

  const results = await Promise.all(tasks);
  console.log("\nAll tasks completed:", results);
}

async function main() {
  console.log("=== Build Project Example ===");
  await buildProject();

  console.log("\n=== Parallel Tasks Example ===");
  await runParallelTasks();
}

main().catch(console.error);

