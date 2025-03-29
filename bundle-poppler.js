const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream');
const AdmZip = require('adm-zip');
const rimraf = require('rimraf');

console.log('Bundling Poppler binaries with the application...');

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

// Create a vendor directory for bundled dependencies
const vendorDir = path.join(__dirname, 'vendor');
if (!fs.existsSync(vendorDir)) {
  fs.mkdirSync(vendorDir, { recursive: true });
}

// Create a poppler subdirectory
const popplerDir = path.join(vendorDir, 'poppler');
if (!fs.existsSync(popplerDir)) {
  fs.mkdirSync(popplerDir, { recursive: true });
}

async function bundlePopplerMac() {
  try {
    // Get the architecture (arm64 or x86_64)
    const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64';
    console.log(`Detected macOS architecture: ${arch}`);
    
    // We'll try to copy binaries from Homebrew first
    let sourceDir = null;
    
    // Try different locations based on architecture
    if (arch === 'arm64') {
      // Apple Silicon paths
      if (fs.existsSync('/opt/homebrew/bin/pdftoppm')) {
        sourceDir = '/opt/homebrew/bin';
      } else {
        // Try to find in Cellar
        const cellarPath = '/opt/homebrew/Cellar/poppler';
        if (fs.existsSync(cellarPath)) {
          // Get the latest version
          const versions = fs.readdirSync(cellarPath);
          if (versions.length > 0) {
            const latestVersion = versions.sort().pop();
            const binPath = path.join(cellarPath, latestVersion, 'bin');
            if (fs.existsSync(binPath) && fs.existsSync(path.join(binPath, 'pdftoppm'))) {
              sourceDir = binPath;
            }
          }
        }
      }
    } else {
      // Intel Mac paths
      if (fs.existsSync('/usr/local/bin/pdftoppm')) {
        sourceDir = '/usr/local/bin';
      } else {
        // Try to find in Cellar
        const cellarPath = '/usr/local/Cellar/poppler';
        if (fs.existsSync(cellarPath)) {
          // Get the latest version
          const versions = fs.readdirSync(cellarPath);
          if (versions.length > 0) {
            const latestVersion = versions.sort().pop();
            const binPath = path.join(cellarPath, latestVersion, 'bin');
            if (fs.existsSync(binPath) && fs.existsSync(path.join(binPath, 'pdftoppm'))) {
              sourceDir = binPath;
            }
          }
        }
      }
    }
    
    if (sourceDir) {
      console.log(`Found Poppler binaries at: ${sourceDir}`);
      
      // Copy essential binaries
      const binaries = ['pdftoppm', 'pdfinfo'];
      for (const binary of binaries) {
        const sourcePath = path.join(sourceDir, binary);
        const destPath = path.join(popplerDir, binary);
        
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, destPath);
          // Make it executable
          fs.chmodSync(destPath, 0o755);
          console.log(`Copied ${binary} to ${destPath}`);
        } else {
          console.warn(`Binary ${binary} not found at ${sourcePath}`);
        }
      }
      
      // Try to copy required dylibs
      try {
        const libOutput = execSync(`otool -L ${path.join(popplerDir, 'pdftoppm')}`).toString();
        const libPaths = libOutput.split('\n')
          .map(line => line.trim().split(' ')[0])
          .filter(lib => lib && lib.includes('/opt/homebrew') || lib.includes('/usr/local'))
          .filter(lib => !lib.includes(':'));
        
        const libsDir = path.join(popplerDir, 'libs');
        if (!fs.existsSync(libsDir)) {
          fs.mkdirSync(libsDir, { recursive: true });
        }
        
        for (const lib of libPaths) {
          if (fs.existsSync(lib)) {
            const libName = path.basename(lib);
            const destPath = path.join(libsDir, libName);
            fs.copyFileSync(lib, destPath);
            console.log(`Copied library ${libName} to ${destPath}`);
          }
        }
      } catch (error) {
        console.warn(`Could not copy libraries: ${error.message}`);
      }
      
      console.log(`Poppler binaries and libraries bundled successfully.`);
      return true;
    } else {
      console.warn('Could not find Poppler binaries on this system.');
      return false;
    }
  } catch (error) {
    console.error(`Error bundling Poppler: ${error.message}`);
    return false;
  }
}

async function bundlePopplerWindows() {
  try {
    // Download the precompiled Windows version
    console.log('Downloading Poppler for Windows...');
    
    const popplerUrl = 'https://github.com/oschwartz10612/poppler-windows/releases/download/v23.05.0-0/Release-23.05.0-0.zip';
    const zipPath = path.join(os.tmpdir(), 'poppler.zip');
    
    await downloadFile(popplerUrl, zipPath);
    console.log('Download complete, extracting...');
    
    // Extract to vendor directory
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(popplerDir, true);
    
    // Clean up zip file
    fs.unlinkSync(zipPath);
    
    console.log(`Poppler for Windows bundled successfully in ${popplerDir}`);
    return true;
  } catch (error) {
    console.error(`Error bundling Poppler for Windows: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  // Clear existing directory if any
  if (fs.existsSync(popplerDir)) {
    console.log(`Cleaning existing Poppler directory: ${popplerDir}`);
    rimraf.sync(popplerDir);
    fs.mkdirSync(popplerDir, { recursive: true });
  }
  
  let success = false;
  
  if (platform === 'darwin') {
    success = await bundlePopplerMac();
  } else if (platform === 'win32') {
    success = await bundlePopplerWindows();
  } else {
    console.log('Platform not supported for bundling Poppler, will attempt to use system-installed version.');
    return;
  }
  
  // Create a config file with the path
  const configPath = path.join(vendorDir, 'poppler-config.json');
  fs.writeFileSync(configPath, JSON.stringify({
    path: popplerDir,
    platform: platform,
    bundled: success,
    date: new Date().toISOString()
  }, null, 2));
  
  console.log(`Poppler configuration saved to: ${configPath}`);
  console.log('Bundling complete!');
}

// Run the main function
main().catch(error => {
  console.error('Failed to bundle Poppler:', error);
  process.exit(1);
});
