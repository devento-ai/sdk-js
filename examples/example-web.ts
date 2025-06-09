import { Tavor } from "../src";

async function runWebService() {
  const tavor = new Tavor();

  console.log("Starting web service example...");

  const box = await tavor.createBox({
    cpu: 2,
    mib_ram: 2048, // 2 GB RAM
    timeout: 600, // 10 minutes
  });

  try {
    console.log(`Created box: ${box.id}`);
    console.log("Waiting for box to be ready...");
    await box.waitUntilReady();

    // Create a simple Node.js web server
    console.log("\nCreating web server...");
    await box.run(`cat > server.js << 'EOF'
const http = require('http');
const port = 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end('<h1>Hello from Tavor!</h1><p>This server is running in a cloud sandbox.</p>');
});

server.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
EOF`);

    // Start the web server
    console.log("\nStarting web server on port 3000...");
    const serverProcess = box.run("node server.js", {
      onStdout: (line) => console.log(`[SERVER] ${line}`),
      onStderr: (line) => console.error(`[SERVER ERROR] ${line}`),
    });

    // Give the server a moment to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get the public URL
    const publicUrl = box.getPublicUrl(3000);
    console.log(`\n✅ Web service is now accessible at: ${publicUrl}`);
    console.log("You can visit this URL in your browser!");

    // Keep the server running for a while
    console.log("\nServer will run for 30 seconds...");
    await new Promise((resolve) => setTimeout(resolve, 30000));

    console.log("\nShutting down...");
  } finally {
    await box.stop();
    console.log("Box stopped.");
  }
}

async function runPythonWebApp() {
  const tavor = new Tavor();

  await tavor.withSandbox(
    async (box) => {
      console.log("\nStarting Python Flask web app...");

      // Create a simple Flask app
      await box.run(`cat > app.py << 'EOF'
from flask import Flask, jsonify
import datetime

app = Flask(__name__)

@app.route('/')
def home():
    return '<h1>Flask App on Tavor</h1><p>Visit <a href="/api/time">/api/time</a> for the current time.</p>'

@app.route('/api/time')
def get_time():
    return jsonify({
        'time': datetime.datetime.now().isoformat(),
        'message': 'Hello from Tavor!'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
EOF`);

      // Install Flask
      console.log("Installing Flask...");
      await box.run("pip install flask", {
        onStdout: (line) => console.log(`  ${line}`),
      });

      // Start the Flask app
      console.log("\nStarting Flask app on port 5000...");
      const flaskProcess = box.run("python app.py", {
        onStdout: (line) => console.log(`[FLASK] ${line}`),
        onStderr: (line) => console.error(`[FLASK ERROR] ${line}`),
      });

      // Give Flask a moment to start
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Get the public URL
      const publicUrl = box.getPublicUrl(5000);
      console.log(`\n✅ Flask app is now accessible at: ${publicUrl}`);
      console.log(`API endpoint: ${publicUrl}/api/time`);

      // Keep the app running
      console.log("\nFlask app will run for 20 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 20000));
    },
    {
      cpu: 2,
      mib_ram: 2048,
      timeout: 300,
    },
  );

  console.log("\nFlask app stopped.");
}

async function main() {
  try {
    // Example 1: Simple Node.js HTTP server
    await runWebService();

    // Example 2: Python Flask app
    await runPythonWebApp();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main().catch(console.error);