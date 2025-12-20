#!/usr/bin/env node
/**
 * Helper script to run Python services using ports from ports.json
 * 
 * This script:
 * - Reads port configuration from packages/core/ports.json
 * - Automatically uses the correct port for each service
 * - Checks if port is available before starting
 * - Optionally kills existing process if port is in use
 * - Ensures ports are centrally managed
 * 
 * Usage: node scripts/run-python-service.js <service-name> [additional-args]
 * 
 * Note: Make sure your Python virtual environment is activated before running.
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Read ports.json
const portsPath = path.join(__dirname, '..', 'packages', 'core', 'ports.json');
const portsConfig = JSON.parse(fs.readFileSync(portsPath, 'utf8'));

// Service name to module path mapping
// Use full path from workspace root: services.websocket.src.main:app
const serviceMap = {
  'websocket': 'services.websocket.src.main:app',
  'agents': 'services.agents.src.api.main:app',
  'rag': 'services.rag.src.api.main:app',
};

// Get service name from command line
const serviceName = process.argv[2];

if (!serviceName) {
  console.error('Error: Service name is required');
  console.error('Usage: node scripts/run-python-service.js <service-name>');
  console.error('Available services:', Object.keys(serviceMap).join(', '));
  process.exit(1);
}

if (!serviceMap[serviceName]) {
  console.error(`Error: Unknown service "${serviceName}"`);
  console.error('Available services:', Object.keys(serviceMap).join(', '));
  process.exit(1);
}

// Get port from ports.json
const port = portsConfig.services[serviceName];

if (!port) {
  console.error(`Error: Port not found for service "${serviceName}" in ports.json`);
  process.exit(1);
}

// Get module path
const modulePath = serviceMap[serviceName];

// Get additional arguments (like --reload)
const additionalArgs = process.argv.slice(3);

// Build uvicorn command
const args = [
  '-m',
  'uvicorn',
  modulePath,
  '--reload',
  '--port',
  port.toString(),
  ...additionalArgs,
];

/**
 * Find the correct Python executable
 * Priority: .venv Python > python3 > python
 */
function findPythonCommand() {
  const venvPython = process.platform === 'win32'
    ? path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe')
    : path.join(__dirname, '..', '.venv', 'bin', 'python3');

  // Check if .venv exists and has Python
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }

  // Fallback to system Python
  return process.platform === 'win32' ? 'python' : 'python3';
}

// Determine Python command
const pythonCmd = findPythonCommand();

/**
 * Check if a port is in use and return the PID if found
 */
function checkPortInUse(port) {
  try {
    if (process.platform === 'win32') {
      // Windows: netstat -ano | findstr :PORT
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      if (result.trim()) {
        // Parse PID from output (last column)
        const lines = result.trim().split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 0 && parts[parts.length - 1] !== '0') {
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(pid)) {
              return parseInt(pid);
            }
          }
        }
      }
    } else {
      // Linux/macOS: lsof -ti:PORT
      const result = execSync(`lsof -ti:${port}`, { encoding: 'utf8' });
      if (result.trim()) {
        const pid = parseInt(result.trim().split('\n')[0]);
        if (!isNaN(pid)) {
          return pid;
        }
      }
    }
  } catch (error) {
    // Port is not in use (command returned error)
    return null;
  }
  return null;
}

/**
 * Kill a process by PID
 */
function killProcess(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Ask user for confirmation
 */
function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
}

/**
 * Main execution
 */
async function main() {
  // Check if port is in use
  const existingPid = checkPortInUse(port);

  if (existingPid) {
    console.warn(`⚠️  Port ${port} is already in use by process ${existingPid}`);
    
    try {
      // Try to get process name for better UX
      let processName = 'unknown process';
      if (process.platform === 'win32') {
        try {
          const tasklist = execSync(`tasklist /FI "PID eq ${existingPid}" /FO CSV /NH`, { encoding: 'utf8' });
          if (tasklist.trim()) {
            const parts = tasklist.split(',');
            if (parts.length > 0) {
              processName = parts[0].replace(/"/g, '');
            }
          }
        } catch (e) {
          // Ignore errors getting process name
        }
      } else {
        try {
          processName = execSync(`ps -p ${existingPid} -o comm=`, { encoding: 'utf8' }).trim();
        } catch (e) {
          // Ignore errors getting process name
        }
      }

      console.log(`   Process: ${processName} (PID: ${existingPid})`);
      const answer = await askQuestion(`\n❓ Kill this process and start ${serviceName} service? (y/n): `);

      if (answer === 'y' || answer === 'yes') {
        console.log(`\n🛑 Killing process ${existingPid}...`);
        if (killProcess(existingPid)) {
          console.log(`✅ Process killed successfully`);
          // Wait a moment for port to be released
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.error(`❌ Failed to kill process ${existingPid}`);
          console.error(`   Please kill it manually and try again`);
          process.exit(1);
        }
      } else {
        console.log(`\n❌ Aborted. Please free port ${port} and try again.`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Error checking/killing process:`, error.message);
      process.exit(1);
    }
  }

  // Start the service
  console.log(`\n🚀 Starting ${serviceName} service on port ${port}...`);
  console.log(`📦 Module: ${modulePath}`);
  
  // Show if using venv or system Python
  const isVenv = pythonCmd.includes('.venv');
  if (isVenv) {
    console.log(`🐍 Using Python from virtual environment`);
  } else {
    console.warn(`⚠️  Using system Python (consider activating .venv)`);
  }
  console.log(`🔧 Command: ${pythonCmd} ${args.join(' ')}\n`);

  // Set up environment variables
  const env = { ...process.env };
  
  // Add workspace root to PYTHONPATH so imports work
  // This allows Python to find 'services' as a top-level package
  const workspaceRoot = path.join(__dirname, '..');
  if (env.PYTHONPATH) {
    // Use platform-specific path separator
    const separator = process.platform === 'win32' ? ';' : ':';
    env.PYTHONPATH = `${workspaceRoot}${separator}${env.PYTHONPATH}`;
  } else {
    env.PYTHONPATH = workspaceRoot;
  }

  // Spawn Python process
  const pythonProcess = spawn(pythonCmd, args, {
    stdio: 'inherit',
    shell: false,
    env: env,
    cwd: workspaceRoot, // Set working directory to workspace root
  });

  pythonProcess.on('error', (error) => {
    console.error(`\n❌ Failed to start ${serviceName} service:`, error.message);
    if (error.code === 'ENOENT') {
      if (pythonCmd.includes('.venv')) {
        console.error(`   Virtual environment Python not found at: ${pythonCmd}`);
        console.error(`   Please run: ./scripts/setup-python-services.sh`);
        console.error(`   Or create virtual environment: python3 -m venv .venv`);
      } else {
        console.error(`   Python not found. Make sure Python is installed and in your PATH.`);
        console.error(`   On Linux/macOS, try: python3`);
        console.error(`   On Windows, try: python`);
      }
    }
    process.exit(1);
  });

  pythonProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n❌ ${serviceName} service exited with code ${code}`);
    }
    process.exit(code || 0);
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log(`\n\n🛑 Stopping ${serviceName} service...`);
    pythonProcess.kill('SIGINT');
    process.exit(0);
  });
}

// Run main function
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

