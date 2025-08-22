import { Devento } from "../src";

async function main() {
  const devento = new Devento({
    // apiKey: "your-api-key", // or use DEVENTO_API_KEY env var
  });

  await devento.withSandbox(async (box) => {
    console.log(`Box ${box.id} is ready!`);

    const result = await box.run(
      'w; echo "Hello from Devento!" | tee /test1; ls -al / | grep test1',
    );
    console.log("Output:", result.stdout);
    console.log("Exit code:", result.exitCode);

    console.log("Snapshots:", await box.listSnapshots());

    const snap = await box.createSnapshot();
    console.log("New snapshot:", snap);

    await box.waitSnapshotReady(snap.id);

    const result2 = await box.run(
      'w; ls -al / | grep test1; cat /test1; echo "new" > /test1',
    );
    console.log("Output:", result2.stdout);
    console.log("Exit code:", result2.exitCode);

    console.log(await box.restoreSnapshot(snap.id));
    await box.waitUntilReady();

    const result3 = await box.run("w; ls -al / | grep /test1; cat /test1");
    console.log("Output:", result3.stdout);
    console.log("Exit code:", result3.exitCode);
  });
}

main().catch(console.error);
