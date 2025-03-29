const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Setting up build environment for AccountantAI...');

// Install dependencies
console.log('Installing dependencies...');
exec('npm install', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error installing dependencies: ${error.message}`);
    return;
  }
  
  console.log('Dependencies installed successfully.');
  
  // Check if dotenv is installed
  if (!fs.existsSync(path.join(__dirname, 'node_modules', 'dotenv'))) {
    console.log('Installing dotenv dependency...');
    exec('npm install dotenv', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error installing dotenv: ${error.message}`);
        return;
      }
      console.log('dotenv installed successfully.');
      buildApplication();
    });
  } else {
    buildApplication();
  }
});

function buildApplication() {
  console.log('Building application...');
  
  // Create .env file if it doesn't exist
  if (!fs.existsSync(path.join(__dirname, '.env'))) {
    console.log('Creating sample .env file...');
    fs.writeFileSync(path.join(__dirname, '.env'), 'ANTHROPIC_API_KEY=your_api_key_here\n');
  }
  
  // Determine platform
  const platform = process.platform === 'darwin' ? 'mac' : 
                  process.platform === 'win32' ? 'win' : 'linux';
  
  console.log(`Building for ${platform}...`);
  
  // Build application
  exec(`npm run package-${platform}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error building application: ${error.message}`);
      return;
    }
    
    console.log('Application built successfully.');
    console.log('You can find the build in the dist directory.');
  });
}
