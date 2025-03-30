const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream');
const AdmZip = require('adm-zip');
const rimraf = require('rimraf');

console.log('Checking and installing Poppler dependency...');

// Determine platform
const platform = process.platform;

// Parse command line arguments
const args = process.argv.slice(2);
const forceInstall = args.includes('--force');
const skipChecks = args.includes('--skip-checks');

// Function to download a file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      pipeline(response, file, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    }).on('error', reject);
  });
}

// Run Python Poppler finder script - optional
function runPopplerFinder() {
  try {
    console.log('Running Poppler finder script to ensure proper configuration...');
    
    // Determine Python executable
    let pythonExecutable;
    if (platform === 'darwin') {
      pythonExecutable = 'python3';
    } else if (platform === 'win32') {
      pythonExecutable = 'python';
    } else {
      pythonExecutable = 'python3';
    }
    
    // Check if the script exists
    if (!fs.existsSync('find-poppler.py')) {
      console.log('find-poppler.py script not found, skipping this step');
      return true;
    }
    
    // Run the script
    execSync(`${pythonExecutable} find-poppler.py`, { stdio: 'inherit' });
    console.log('Poppler finder script completed successfully.');
    return true;
  } catch (error) {
    console.error('Error running Poppler finder script:', error.message);
    // Not critical, so return true anyway
    return true;
  }
}

async function checkPopplerMac() {
  try {
    // Check if poppler is installed
    try {
      const result = execSync('which pdftoppm', { stdio: 'pipe' });
      console.log('Poppler is already installed at:', result.toString().trim());
      return true;
    } catch (error) {
      console.log('Poppler not found in system PATH');
      
      // Try common homebrew locations
      const commonPaths = [
        '/opt/homebrew/bin/pdftoppm',  // Apple Silicon
        '/usr/local/bin/pdftoppm',     // Intel Macs
        '/opt/local/bin/pdftoppm'      // MacPorts
      ];
      
      for (const popplerPath of commonPaths) {
        if (fs.existsSync(popplerPath)) {
          console.log(`Poppler found at: ${popplerPath}`);
          return true;
        }
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error checking for Poppler:', error.message);
    return false;
  }
}

async function checkPopplerWindows() {
  // Define common paths where poppler might be installed
  const popplerDir = path.join(os.homedir(), 'poppler');
  const popplerBinDir = path.join(popplerDir, 'bin');
  
  // Try to find poppler in common locations
  const commonPaths = [
    popplerBinDir,
    path.join('C:', 'poppler', 'bin'),
    path.join('C:', 'Program Files', 'poppler', 'bin'),
    path.join('C:', 'Program Files (x86)', 'poppler', 'bin')
  ];
  
  for (const binPath of commonPaths) {
    if (fs.existsSync(path.join(binPath, 'pdftoppm.exe'))) {
      console.log(`Poppler found at: ${binPath}`);
      return true;
    }
  }
  
  console.log('Poppler not found in common locations on Windows');
  return false;
}

async function installPopplerMac() {
  try {
    // Check if poppler is already installed
    const popplerInstalled = await checkPopplerMac();
    if (popplerInstalled && !forceInstall) {
      console.log('Poppler is already installed.');
      return true;
    }
    
    // Check if brew is installed
    try {
      execSync('which brew', { stdio: 'pipe' });
      console.log('Homebrew is installed.');
    } catch (error) {
      console.log('Homebrew is not installed. Installing Homebrew...');
      try {
        execSync('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"', 
          { stdio: 'inherit' });
        console.log('Homebrew installed successfully.');
      } catch (brewError) {
        console.error('Failed to install Homebrew:', brewError.message);
        console.log('Please install Homebrew manually and then run this script again.');
        return false;
      }
    }

    // Install poppler using Homebrew
    console.log('Installing Poppler using Homebrew...');
    try {
      execSync('brew install poppler', { stdio: 'inherit' });
      console.log('Poppler installed successfully.');
      return true;
    } catch (popplerError) {
      console.error('Failed to install Poppler:', popplerError.message);
      console.log('Please install Poppler manually using: brew install poppler');
      return false;
    }
  } catch (error) {
    console.error('Error installing Poppler:', error.message);
    return false;
  }
}

async function installPopplerWindows() {
  // Define the directory where poppler will be installed
  const popplerDir = path.join(os.homedir(), 'poppler');
  const popplerBinDir = path.join(popplerDir, 'bin');
  
  // Check if poppler is already installed
  const popplerInstalled = await checkPopplerWindows();
  if (popplerInstalled && !forceInstall) {
    console.log('Poppler is already installed.');
    // Add to PATH if not already there
    updateWindowsPath(popplerBinDir);
    return true;
  }

  console.log('Poppler is not installed. Installing Poppler...');
  
  try {
    // Create poppler directory if it doesn't exist
    if (!fs.existsSync(popplerDir)) {
      fs.mkdirSync(popplerDir, { recursive: true });
    }

    // Download poppler from a trusted source
    const popplerUrl = 'https://github.com/oschwartz10612/poppler-windows/releases/download/v23.05.0-0/Release-23.05.0-0.zip';
    const zipPath = path.join(os.tmpdir(), 'poppler.zip');
    
    console.log('Downloading Poppler...');
    await downloadFile(popplerUrl, zipPath);
    
    console.log('Extracting Poppler...');
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(popplerDir, true);
    
    // Clean up
    fs.unlinkSync(zipPath);
    
    // Add to PATH
    updateWindowsPath(popplerBinDir);
    
    console.log('Poppler installed successfully to:', popplerDir);
    console.log('Poppler binary directory added to PATH.');
    
    return true;
  } catch (error) {
    console.error('Error installing Poppler:', error.message);
    console.log('Please install Poppler manually from: http://blog.alivate.com.au/poppler-windows/');
    return false;
  }
}

function updateWindowsPath(popplerBinDir) {
  try {
    // Add to environment variable for this process
    process.env.PATH = `${popplerBinDir};${process.env.PATH}`;
    
    // Update system PATH (requires admin privileges)
    console.log('To permanently add Poppler to your system PATH, run the following command in an Administrator Command Prompt:');
    console.log(`setx /M PATH "%PATH%;${popplerBinDir}"`);
    
    // Set POPPLER_PATH environment variable for this process
    process.env.POPPLER_PATH = popplerBinDir;
    
    // We will also update the .env file if it exists
    try {
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (!envContent.includes('POPPLER_PATH=')) {
          envContent += `\nPOPPLER_PATH=${popplerBinDir.replace(/\\/g, '\\\\')}\n`;
          fs.writeFileSync(envPath, envContent);
          console.log('Added POPPLER_PATH to .env file.');
        }
      }
    } catch (envError) {
      console.warn('Could not update .env file:', envError.message);
    }
  } catch (error) {
    console.error('Error updating PATH:', error.message);
  }
}

// Main function
async function main() {
  if (skipChecks) {
    console.log('Skipping poppler checks and installation');
    return 0;
  }
  
  let success = false;
  
  if (platform === 'darwin') {
    // On macOS, first check if poppler is already installed
    const popplerInstalled = await checkPopplerMac();
    if (popplerInstalled && !forceInstall) {
      console.log('Poppler is already installed on macOS, no need to install.');
      success = true;
    } else {
      success = await installPopplerMac();
    }
  } else if (platform === 'win32') {
    // On Windows, first check if poppler is already installed
    const popplerInstalled = await checkPopplerWindows();
    if (popplerInstalled && !forceInstall) {
      console.log('Poppler is already installed on Windows, no need to install.');
      success = true;
    } else {
      success = await installPopplerWindows();
    }
  } else {
    console.log('Platform not supported for automatic Poppler installation.');
    console.log('Please install Poppler manually:');
    console.log('- Ubuntu/Debian: sudo apt-get install poppler-utils');
    console.log('- Fedora/RHEL: sudo dnf install poppler-utils');
    success = false;
  }
  
  // Run the finder script if needed (not critical)
  if (success && !skipChecks) {
    runPopplerFinder();
  }
  
  console.log('Poppler dependency check completed.');
  
  // Return exit code
  return success ? 0 : 1;
}

// Run the main function
if (require.main === module) {
  main().then(exitCode => {
    if (exitCode !== 0) {
      console.log('Poppler installation failed, but the application can still be started.');
      console.log('Poppler will be checked for again when processing documents.');
      // Exit with success (0) even if the installation failed
      process.exit(0);
    } else {
      process.exit(0);
    }
  }).catch(error => {
    console.error('Failed to install Poppler:', error.message);
    // Exit with success (0) even if the installation failed
    process.exit(0);
  });
}

// Export functions for use in other modules
module.exports = {
  checkPopplerMac,
  checkPopplerWindows,
  installPopplerMac,
  installPopplerWindows,
  updateWindowsPath
};
