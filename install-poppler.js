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

// Run Python Poppler finder script
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
    
    // Run the script
    execSync(`${pythonExecutable} find-poppler.py`, { stdio: 'inherit' });
    console.log('Poppler finder script completed successfully.');
    return true;
  } catch (error) {
    console.error('Error running Poppler finder script:', error.message);
    return false;
  }
}

async function installPopplerMac() {
  try {
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
        process.exit(1);
      }
    }

    // Check if poppler is installed
    try {
      execSync('which pdftoppm', { stdio: 'pipe' });
      console.log('Poppler is already installed.');
    } catch (error) {
      console.log('Poppler is not installed. Installing Poppler...');
      try {
        execSync('brew install poppler', { stdio: 'inherit' });
        console.log('Poppler installed successfully.');
      } catch (popplerError) {
        console.error('Failed to install Poppler:', popplerError.message);
        console.log('Please install Poppler manually using: brew install poppler');
        process.exit(1);
      }
    }
    
    // Run the Poppler finder script
    runPopplerFinder();
    
  } catch (error) {
    console.error('Error installing Poppler:', error.message);
    process.exit(1);
  }
}

async function installPopplerWindows() {
  // Define the directory where poppler will be installed
  const popplerDir = path.join(os.homedir(), 'poppler');
  const popplerBinDir = path.join(popplerDir, 'bin');
  
  // Check if poppler is already installed
  if (fs.existsSync(path.join(popplerBinDir, 'pdftoppm.exe'))) {
    console.log('Poppler is already installed.');
    // Add to PATH if not already there
    updateWindowsPath(popplerBinDir);
    return;
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
    
    // Run the Poppler finder script
    runPopplerFinder();
    
  } catch (error) {
    console.error('Error installing Poppler:', error.message);
    console.log('Please install Poppler manually from: http://blog.alivate.com.au/poppler-windows/');
    process.exit(1);
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
  if (platform === 'darwin') {
    await installPopplerMac();
  } else if (platform === 'win32') {
    await installPopplerWindows();
  } else {
    console.log('Platform not supported for automatic Poppler installation.');
    console.log('Please install Poppler manually:');
    console.log('- Ubuntu/Debian: sudo apt-get install poppler-utils');
    console.log('- Fedora/RHEL: sudo dnf install poppler-utils');
    
    // Still try to run the finder script
    runPopplerFinder();
  }
  
  console.log('Poppler dependency check completed.');
}

// Run the main function
main().catch(error => {
  console.error('Failed to install Poppler:', error.message);
  process.exit(1);
});
