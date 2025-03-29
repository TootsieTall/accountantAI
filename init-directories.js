const fs = require('fs');
const path = require('path');
const os = require('os');

function getAppDataDirectory() {
  // Determine the appropriate data directory based on the platform
  if (process.platform === 'darwin') {
    // On macOS, use ~/Library/Application Support/AccountantAI
    return path.join(os.homedir(), 'Library', 'Application Support', 'AccountantAI');
  } else if (process.platform === 'win32') {
    // On Windows, use %APPDATA%\\AccountantAI instead of installation directory
    // This is more aligned with Windows conventions and avoids permission issues
    return process.env.APPDATA ? path.join(process.env.APPDATA, 'AccountantAI') : 
           path.join(os.homedir(), 'AppData', 'Roaming', 'AccountantAI');
  } else {
    // On Linux/Unix, use ~/.accountantai
    return path.join(os.homedir(), '.accountantai');
  }
}

function createDataDirectories() {
  const appDir = getAppDataDirectory();
  console.log('Creating data directories in:', appDir);
  
  // Create main app directory if it doesn't exist (needed for macOS)
  if (!fs.existsSync(appDir)) {
    console.log('Creating app directory:', appDir);
    fs.mkdirSync(appDir, { recursive: true });
  }
  
  // Create data structure
  const dataDir = path.join(appDir, 'data');
  const sourceDir = path.join(dataDir, 'source_documents');
  const processedDir = path.join(dataDir, 'processed');
  const logsDir = path.join(dataDir, 'logs');
  
  // Create directories
  [dataDir, sourceDir, processedDir, logsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log('Creating directory:', dir);
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Note: The A-Z directory creation code has been removed
  
  // Create a sample .env file if not exists
  const envPath = path.join(appDir, '.env');
  if (!fs.existsSync(envPath)) {
    // First look for .env in current directory (during build)
    const sourcePath = path.join(process.cwd(), '.env');
    if (fs.existsSync(sourcePath)) {
      // Copy existing .env file
      console.log('Copying .env file from build directory to:', envPath);
      fs.copyFileSync(sourcePath, envPath);
    } else {
      // Create new .env file
      console.log('Creating sample .env file at:', envPath);
      const envContent = '# Add your Anthropic API key below\nANTHROPIC_API_KEY=your_api_key_here\n';
      fs.writeFileSync(envPath, envContent);
    }
  }

  // Also look for an .env in the data directory (from extraResources)
  const dataEnvPath = path.join(dataDir, '.env');
  if (fs.existsSync(dataEnvPath)) {
    console.log('Found .env in data directory, copying to app root');
    fs.copyFileSync(dataEnvPath, envPath);
  }
  
  console.log('Data directories created successfully');
  return appDir;
}

// Create data directories when executing directly
if (require.main === module) {
  createDataDirectories();
}

// Run initialization if --initialize-data-directory flag is passed
if (process.argv.includes('--initialize-data-directory')) {
  createDataDirectories();
  // Exit after initialization
  setTimeout(() => process.exit(0), 1000);
}

module.exports = { createDataDirectories, getAppDataDirectory };
