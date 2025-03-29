const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const kill = require('tree-kill');
const dotenv = require('dotenv');

// Import directory helper
let initDirectories;
try {
  initDirectories = require('./init-directories');
} catch (e) {
  console.error('Error importing init-directories.js:', e);
  // Fallback implementation
  initDirectories = {
    getAppDataDirectory: () => {
      const os = require('os');
      if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'AccountantAI');
      } else if (process.platform === 'win32') {
        return process.env.APPDATA ? path.join(process.env.APPDATA, 'AccountantAI') : 
               path.join(os.homedir(), 'AppData', 'Roaming', 'AccountantAI');
      } else {
        return path.join(os.homedir(), '.accountantai');
      }
    },
    createDataDirectories: function() {
      return this.getAppDataDirectory();
    }
  };
}

// Check if app is being run with the initialize-data-directory flag
const isInitializingDirectories = process.argv.includes('--initialize-data-directory');

let mainWindow;
let pythonProcess = null;
let appDataDir;

// Get the proper data directory paths
function getDataDirectories() {
  // Get the app data directory first
  appDataDir = initDirectories.getAppDataDirectory();
  
  // Define paths based on the app data directory
  const dataDir = path.join(appDataDir, 'data');
  const sourceDir = path.join(dataDir, 'source_documents');
  const processedDir = path.join(dataDir, 'processed');
  const metadataDir = path.join(dataDir, 'metadata');
  const logsDir = path.join(dataDir, 'logs');
  
  return {
    appDataDir,
    dataDir,
    sourceDir,
    processedDir,
    metadataDir,
    logsDir
  };
}

function createWindow() {
  // Skip window creation when initializing directories
  if (isInitializingDirectories) {
    return;
  }

  // Set up app icon based on platform
  let iconPath;
  if (process.platform === 'win32') {
    iconPath = path.join(__dirname, 'assets/icon.ico');
  } else if (process.platform === 'darwin') {
    iconPath = path.join(__dirname, 'assets/icon.icns');
  } else {
    iconPath = path.join(__dirname, 'assets/icon.png');
  }

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false // Allow loading local files
    }
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Create data directories if needed
  ensureDataDirectories();

  mainWindow.on('closed', function () {
    mainWindow = null;
    
    // Terminate Python process when window is closed
    if (pythonProcess) {
      console.log(`Terminating Python process (PID: ${pythonProcess.pid})`);
      
      if (process.platform === 'win32') {
        kill(pythonProcess.pid, 'SIGTERM', (err) => {
          if (err) console.error(`Failed to kill process: ${err}`);
        });
      } else {
        pythonProcess.kill('SIGTERM');
      }
      pythonProcess = null;
    }
  });
}

// Initialize app
app.whenReady().then(() => {
  if (isInitializingDirectories) {
    // Run the directory initialization
    console.log("Initializing data directories...");
    ensureDataDirectories();
    console.log("Initialization complete, exiting.");
    
    // Give some time for console output before exiting
    setTimeout(() => {
      app.quit();
    }, 1000);
  } else {
    // Normal application startup
    createWindow();
  }
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// Ensure all required directories exist
function ensureDataDirectories() {
  // Get proper directory paths
  const { dataDir, sourceDir, processedDir, metadataDir, logsDir } = getDataDirectories();
  
  // Create directories
  [dataDir, sourceDir, processedDir, metadataDir, logsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log('Creating directory:', dir);
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Create a sample .env file if not exists
  const envPath = path.join(appDataDir, '.env');
  if (!fs.existsSync(envPath)) {
    console.log('Creating sample .env file at:', envPath);
    const envContent = '# Add your Anthropic API key below\nANTHROPIC_API_KEY=your_api_key_here\n';
    fs.writeFileSync(envPath, envContent);
  }
  
  return { dataDir, sourceDir, processedDir, metadataDir, logsDir };
}

// Get the path to the .env file
function getEnvFilePath() {
  return path.join(getDataDirectories().appDataDir, '.env');
}

// ----------- IPC HANDLERS -----------

// NEW: Handler for opening results folder directly
ipcMain.handle('open-results-folder', async (event, folderPath) => {
  try {
    console.log(`Received request to open results folder: ${folderPath}`);
    const { processedDir } = getDataDirectories();
    
    // Determine the path to open
    let targetPath;
    if (!folderPath || folderPath === 'processed') {
      targetPath = processedDir;
    } else if (folderPath.startsWith('processed/')) {
      const relativePath = folderPath.substring('processed/'.length);
      targetPath = path.join(processedDir, relativePath);
    } else {
      targetPath = path.join(processedDir, folderPath);
    }
    
    console.log(`Opening folder in system file explorer: ${targetPath}`);
    
    // Check if folder exists
    if (!fs.existsSync(targetPath)) {
      console.error(`Folder not found: ${targetPath}`);
      return { 
        success: false, 
        error: `Folder not found: ${targetPath}`
      };
    }
    
    // Open folder with system default file explorer
    // This is the critical line that actually opens the folder
    if (process.platform === 'win32') {
      // On Windows, use the start command via exec
      require('child_process').exec(`start "" "${targetPath}"`);
    } else if (process.platform === 'darwin') {
      // On macOS, use the open command
      require('child_process').exec(`open "${targetPath}"`);
    } else {
      // On Linux or other platforms, try shell.openPath
      shell.openPath(targetPath);
    }
    
    return {
      success: true,
      path: targetPath
    };
  } catch (error) {
    console.error(`Error opening folder: ${error.message}`);
    return { 
      success: false, 
      error: error.message
    };
  }
});

// Handle get-api-key request from renderer
ipcMain.handle('get-api-key', async () => {
  const envPath = getEnvFilePath();
  console.log(`Looking for .env file at: ${envPath}`);
  
  try {
    if (!fs.existsSync(envPath)) {
      console.log('.env file not found, creating a default one');
      fs.writeFileSync(envPath, 'ANTHROPIC_API_KEY=your_api_key_here\n');
      return '';
    }
    
    // Read and parse the .env file
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = dotenv.parse(envContent);
    
    // Return the API key
    return envVars.ANTHROPIC_API_KEY || '';
  } catch (error) {
    console.error(`Error loading API key: ${error.message}`);
    return '';
  }
});

// Handle save-api-key request from renderer
ipcMain.handle('save-api-key', async (event, apiKey) => {
  const envPath = getEnvFilePath();
  
  try {
    // Create or update the .env file
    fs.writeFileSync(envPath, `ANTHROPIC_API_KEY=${apiKey}\n`);
    console.log(`API key saved to: ${envPath}`);
    return true;
  } catch (error) {
    console.error(`Error saving API key: ${error.message}`);
    return false;
  }
});

// Handle file upload dialog
ipcMain.handle('open-file-dialog', async () => {
  if (!mainWindow) return [];
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Documents', extensions: ['pdf', 'txt', 'docx', 'doc', 'csv', 'xlsx', 'xls'] }
    ]
  });
  
  if (result.canceled) {
    return [];
  }
  
  return result.filePaths;
});

// File processing function - used by both handlers
async function processUploadedFiles(filePaths) {
  const { sourceDir } = getDataDirectories();
  const results = [];
  let successCount = 0;
  let failedCount = 0;
  
  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);
    const targetPath = path.join(sourceDir, fileName);
    
    try {
      // Copy file to source directory
      fs.copyFileSync(filePath, targetPath);
      console.log(`Copied ${fileName} to ${targetPath}`);
      results.push({ 
        file: fileName, 
        success: true,
        message: `Copied to ${targetPath}`
      });
      successCount++;
    } catch (error) {
      console.error(`Error copying file ${fileName}: ${error.message}`);
      results.push({
        file: fileName,
        success: false,
        message: error.message
      });
      failedCount++;
    }
  }
  
  // Return results in a format expected by the renderer
  return {
    success: successCount,
    failed: failedCount,
    results: results
  };
}

// Handle files-dropped event from drag and drop
ipcMain.handle('files-dropped', async (event, filePaths) => {
  console.log('Files dropped event received with paths:', filePaths);
  return processUploadedFiles(filePaths);
});

// Handle file processing
ipcMain.handle('process-files', async (event, filePaths) => {
  return processUploadedFiles(filePaths);
});

// Function to start Python process
async function startPythonProcess(clientName = '', options = {}) {
  // First check if a Python process is already running
  if (pythonProcess) {
    console.log(`Python process is already running (PID: ${pythonProcess.pid})`);
    return { success: true, alreadyRunning: true };
  }
  
  try {
    // Determine the directories 
    const { appDataDir, dataDir } = getDataDirectories();
    
    // Read the API key from the .env file
    const envPath = getEnvFilePath();
    if (!fs.existsSync(envPath)) {
      return { 
        success: false, 
        error: 'API key not set. Please set your API key in the settings.'
      };
    }
    
    // Load the .env file content
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = dotenv.parse(envContent);
    
    if (!envVars.ANTHROPIC_API_KEY || envVars.ANTHROPIC_API_KEY === 'your_api_key_here') {
      return { 
        success: false, 
        error: 'API key not set or using default value. Please update your API key in the settings.'
      };
    }
    
    // Set environment variables for the Python process
    const env = {
      ...process.env,
      ANTHROPIC_API_KEY: envVars.ANTHROPIC_API_KEY,
      APP_DATA_DIR: appDataDir
    };
    
    // Add client name to environment if provided
    if (clientName) {
      env.CLIENT_NAME = clientName;
      console.log(`Processing documents for client: ${clientName}`);
    }
    
    // Construct the command to run
    let pythonExecutable;
    let scriptPath;
    let args = [];
    
    // We need to make sure we have access to the main.py file
    // Copy main.py and other necessary files to the app data directory if they don't exist
    const appDataPyPath = path.join(appDataDir, 'main.py');
    const originalPyPath = path.join(__dirname, 'main.py');
    
    // Copy the Python scripts if they don't exist in the app data directory
    if (!fs.existsSync(appDataPyPath)) {
      console.log(`Copying main.py from ${originalPyPath} to ${appDataPyPath}`);
      try {
        fs.copyFileSync(originalPyPath, appDataPyPath);
        
        // Also copy the src directory if it exists
        const srcDir = path.join(__dirname, 'src');
        const appDataSrcDir = path.join(appDataDir, 'src');
        
        if (fs.existsSync(srcDir)) {
          if (!fs.existsSync(appDataSrcDir)) {
            fs.mkdirSync(appDataSrcDir, { recursive: true });
          }
          
          // Copy all files from src directory
          const srcFiles = fs.readdirSync(srcDir);
          for (const file of srcFiles) {
            const srcFile = path.join(srcDir, file);
            const destFile = path.join(appDataSrcDir, file);
            
            if (fs.statSync(srcFile).isFile()) {
              fs.copyFileSync(srcFile, destFile);
              console.log(`Copied ${srcFile} to ${destFile}`);
            }
          }
        }
        
        // Copy config.py if it exists
        const configPath = path.join(__dirname, 'config.py');
        const appDataConfigPath = path.join(appDataDir, 'config.py');
        
        if (fs.existsSync(configPath)) {
          fs.copyFileSync(configPath, appDataConfigPath);
          console.log(`Copied config.py to ${appDataConfigPath}`);
        }
      } catch (err) {
        console.error(`Error copying Python files: ${err.message}`);
        return { success: false, error: `Failed to set up Python environment: ${err.message}` };
      }
    }
    
    // Now use the copied script path
    scriptPath = appDataPyPath;
    
    // Determine correct Python executable based on platform
    if (process.platform === 'darwin') {
      // macOS usually has python3
      pythonExecutable = 'python3';
    } else if (process.platform === 'win32') {
      // Windows might have python or py
      pythonExecutable = 'python';
    } else {
      // Linux likely has python3
      pythonExecutable = 'python3';
    }
    
    // Log which executable we're trying to use
    console.log(`Using Python executable: ${pythonExecutable}`);
    console.log(`Script path: ${scriptPath}`);
    
    args = [scriptPath];
    
    console.log(`Starting Python process: ${pythonExecutable} ${args.join(' ')}`);
    
    // Spawn the Python process with the app data directory as working directory
    pythonProcess = spawn(pythonExecutable, args, {
      env,
      cwd: appDataDir // Set working directory to app data directory
    });
    
    // Set up handlers for the Python process
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Python stdout: ${output}`);
      
      // Parse and handle Python output for UI updates
      try {
        // Check if output is JSON
        if (output.trim().startsWith('{') && output.trim().endsWith('}')) {
          const jsonData = JSON.parse(output);
          
          // If it has status property, send as process-status event
          if (jsonData.status) {
            if (mainWindow) {
              mainWindow.webContents.send('process-status', jsonData);
            }
          }
          // If it has final results, send as process-result event
          else if (jsonData.success !== undefined) {
            if (mainWindow) {
              mainWindow.webContents.send('process-result', jsonData);
            }
          }
        } else {
          // Non-JSON output - send as regular status update
          if (mainWindow) {
            mainWindow.webContents.send('process-status', {
              status: 'running',
              data: output
            });
          }
        }
      } catch (error) {
        // If not valid JSON or other error, just send as regular output
        if (mainWindow) {
          mainWindow.webContents.send('python-output', output);
        }
      }
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const errorOutput = data.toString();
      console.error(`Python stderr: ${errorOutput}`);
      if (mainWindow) {
        mainWindow.webContents.send('python-error', errorOutput);
        // Also send as status update with error type
        mainWindow.webContents.send('process-status', {
          status: 'error',
          data: errorOutput
        });
      }
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      
      // Send exit event
      if (mainWindow) {
        mainWindow.webContents.send('python-exit', code);
        
        // Send final status based on exit code
        if (code === 0) {
          mainWindow.webContents.send('process-result', {
            success: true,
            message: 'Processing completed successfully',
            processed: 1 // Placeholder count
          });
        } else {
          mainWindow.webContents.send('process-result', {
            success: false,
            message: `Processing failed with exit code ${code}`,
            processed: 0
          });
        }
      }
      
      pythonProcess = null;
    });
    
    // Return success
    return { success: true, pid: pythonProcess.pid };
  } catch (error) {
    console.error(`Error starting Python process: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Handle process-documents request from renderer
ipcMain.handle('process-documents', async (event, clientName = '') => {
  console.log('IPC: process-documents receiced with client name:', clientName);
  
  // Send initial status message
  if (mainWindow) {
    mainWindow.webContents.send('process-status', {
      status: 'starting',
      message: clientName 
        ? `Starting document processing for client: ${clientName}...`
        : 'Starting document processing...'
    });
  }

  // Check if Python process is already running
  if (pythonProcess) {
    // If already running, just return success
    if (mainWindow) {
      mainWindow.webContents.send('process-status', {
        status: 'running',
        message: 'Document processing already running',
        data: 'Python process is already active'
      });
    }
    return { success: true, alreadyRunning: true };
  }

  try {
    // Start the Python process using our shared function
    const result = await startPythonProcess(clientName);
    
    if (!result.success) {
      if (mainWindow) {
        mainWindow.webContents.send('process-status', {
          status: 'error',
          message: 'Failed to start processing',
          data: result.error
        });
      }
      return { success: false, message: result.error || 'Failed to start Python process' };
    }

    // Return success
    return { 
      success: true, 
      message: 'Document processing started', 
      pid: result.pid 
    };
  } catch (error) {
    console.error('Error starting document processing:', error);
    if (mainWindow) {
      mainWindow.webContents.send('process-status', {
        status: 'error',
        message: 'Error starting document processing',
        data: error.message
      });
    }
    return { success: false, message: error.message };
  }
});

// Start Python process handler
ipcMain.handle('start-python', async (event, clientName = '', options = {}) => {
  return startPythonProcess(clientName, options);
});

// Stop Python process handler
ipcMain.handle('stop-python', async () => {
  if (!pythonProcess) {
    return { success: true, notRunning: true };
  }
  
  try {
    console.log(`Stopping Python process (PID: ${pythonProcess.pid})`);
    
    if (process.platform === 'win32') {
      kill(pythonProcess.pid, 'SIGTERM', (err) => {
        if (err) {
          console.error(`Failed to kill process: ${err}`);
          return { success: false, error: err.message };
        }
      });
    } else {
      pythonProcess.kill('SIGTERM');
    }
    
    // Set a timeout to ensure the process is killed
    setTimeout(() => {
      if (pythonProcess) {
        console.log(`Forcing Python process termination (PID: ${pythonProcess.pid})`);
        if (process.platform === 'win32') {
          kill(pythonProcess.pid, 'SIGKILL');
        } else {
          pythonProcess.kill('SIGKILL');
        }
      }
    }, 5000);
    
    pythonProcess = null;
    return { success: true };
  } catch (error) {
    console.error(`Error stopping Python process: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Add debugging IPC handler
ipcMain.handle('debug-paths', async () => {
  try {
    const paths = getDataDirectories();
    
    // Check if directories exist
    const dirStatus = {};
    for (const [key, dirPath] of Object.entries(paths)) {
      dirStatus[key] = {
        path: dirPath,
        exists: fs.existsSync(dirPath),
        contents: fs.existsSync(dirPath) ? fs.readdirSync(dirPath) : []
      };
    }
    
    return {
      success: true,
      paths: dirStatus
    };
  } catch (error) {
    console.error('Debug error:', error);
    return { success: false, error: error.message };
  }
});

// Get data directory paths
ipcMain.handle('get-data-paths', async () => {
  return getDataDirectories();
});

// Handle file URL creation for previewing
ipcMain.handle('get-file-url', async (event, filePath) => {
  try {
    // Get the proper data directories
    const { processedDir } = getDataDirectories();
    
    // If the path doesn't start with the app data directory, prepend it
    let absoluteFilePath;
    if (path.isAbsolute(filePath)) {
      absoluteFilePath = filePath;
    } else {
      // Check if the filePath starts with 'processed/' already
      if (filePath.startsWith('processed/')) {
        // If it already includes 'processed/', strip it out to avoid duplication
        const relativePath = filePath.substring('processed/'.length);
        absoluteFilePath = path.join(processedDir, relativePath);
      } else {
        // Otherwise, use the provided path and join it with processedDir
        absoluteFilePath = path.join(processedDir, filePath);
      }
    }
    
    console.log(`Opening file: ${absoluteFilePath}`);
    
    // Check if file exists
    if (!fs.existsSync(absoluteFilePath)) {
      console.error(`File not found: ${absoluteFilePath}`);
      return { 
        success: false, 
        error: `File not found: ${absoluteFilePath}`
      };
    }
    
    // For PDFs, use shell.openPath to open it with the default system viewer
    shell.openPath(absoluteFilePath);
    
    return {
      success: true,
      path: absoluteFilePath
    };
  } catch (error) {
    console.error(`Error opening file: ${error.message}`);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// NEW: Handle file deletion
ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    // Get the proper data directories
    const { processedDir, metadataDir } = getDataDirectories();
    
    // If the path doesn't start with the app data directory, prepend it
    let absoluteFilePath;
    if (path.isAbsolute(filePath)) {
      absoluteFilePath = filePath;
    } else {
      // Check if the filePath starts with 'processed/' already
      if (filePath.startsWith('processed/')) {
        // If it already includes 'processed/', strip it out to avoid duplication
        const relativePath = filePath.substring('processed/'.length);
        absoluteFilePath = path.join(processedDir, relativePath);
      } else {
        // Otherwise, use the provided path and join it with processedDir
        absoluteFilePath = path.join(processedDir, filePath);
      }
    }
    
    console.log(`Deleting file: ${absoluteFilePath}`);
    
    // Check if file exists
    if (!fs.existsSync(absoluteFilePath)) {
      console.error(`File not found: ${absoluteFilePath}`);
      return { 
        success: false, 
        error: `File not found: ${absoluteFilePath}`
      };
    }
    
    // Delete the file
    fs.unlinkSync(absoluteFilePath);
    
    // Also try to delete the corresponding metadata file if it exists
    // Construct the metadata path by replacing the processedDir with metadataDir in the path
    // and changing the extension to .json
    const relativePath = path.relative(processedDir, absoluteFilePath);
    const metadataPath = path.join(metadataDir, relativePath);
    const metadataJsonPath = metadataPath.replace(/\.[^.]+$/, '.json');
    
    console.log(`Checking for metadata file: ${metadataJsonPath}`);
    
    if (fs.existsSync(metadataJsonPath)) {
      console.log(`Deleting metadata file: ${metadataJsonPath}`);
      fs.unlinkSync(metadataJsonPath);
    }
    
    return {
      success: true,
      path: absoluteFilePath
    };
  } catch (error) {
    console.error(`Error deleting file: ${error.message}`);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// Handle directory content listing
ipcMain.handle('get-directory-contents', async (event, dirPath) => {
  try {
    // Get the proper data directories
    const { processedDir } = getDataDirectories();
    
    // If no path provided, use the processed directory
    let targetPath;
    if (!dirPath || dirPath === 'processed') {
      targetPath = processedDir;
    } else {
      // Check if the dirPath starts with 'processed/' already
      if (dirPath.startsWith('processed/')) {
        // If it already includes 'processed/', strip it out to avoid duplication
        const relativePath = dirPath.substring('processed/'.length);
        targetPath = path.join(processedDir, relativePath);
      } else {
        // Otherwise, use the provided path and join it with processedDir
        targetPath = path.isAbsolute(dirPath) ? dirPath : path.join(processedDir, dirPath);
      }
    }
    
    console.log(`Loading directory contents from: ${targetPath}`);
    
    // Check if directory exists
    if (!fs.existsSync(targetPath)) {
      return { 
        error: `Directory not found: ${targetPath}`,
        path: dirPath
      };
    }
    
    // Read directory contents
    const contents = fs.readdirSync(targetPath);
    
    // Separate directories and files
    const dirs = [];
    const files = [];
    
    for (const item of contents) {
      const itemPath = path.join(targetPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        dirs.push(item);
      } else {
        files.push(item);
      }
    }
    
    // Sort alphabetically
    dirs.sort();
    files.sort();
    
    return {
      path: dirPath || 'processed',
      dirs,
      files,
      fullPath: targetPath
    };
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return { 
      error: error.message,
      path: dirPath 
    };
  }
});

// IPC handler for checkpoint reset
ipcMain.handle('resetCheckpoint', async () => {
  try {
    const { dataDir } = getDataDirectories();
    const checkpointPath = path.join(dataDir, 'checkpoint.json');
    if (fs.existsSync(checkpointPath)) {
      fs.writeFileSync(checkpointPath, '[]');
      console.log('Checkpoint reset successfully');
      return { success: true };
    }
    return { success: true, message: 'No checkpoint file found' };
  } catch (error) {
    console.error('Error resetting checkpoint:', error);
    return { success: false, error: error.message };
  }
});

// Handle file/folder renaming
ipcMain.handle('rename-file', async (event, data) => {
  try {
    const { oldPath, newName, newPath } = data;
    
    if (!oldPath || (!newName && !newPath)) {
      return { success: false, error: 'Invalid parameters' };
    }
    
    // Get directories
    const { processedDir } = getDataDirectories();
    
    // Resolve source path
    const sourcePath = path.isAbsolute(oldPath) ? oldPath : path.join(processedDir, oldPath);
    
    // Determine target path based on whether newName or newPath is provided
    let targetPath;
    if (newPath) {
      // If newPath is provided, use it directly (for moves between folders)
      targetPath = path.isAbsolute(newPath) ? newPath : path.join(processedDir, newPath);
    } else {
      // For renames, keep in same directory but change filename
      const dirName = path.dirname(sourcePath);
      targetPath = path.join(dirName, newName);
    }
    
    console.log(`Renaming/Moving ${sourcePath} to ${targetPath}`);
    
    // Check if target already exists
    if (fs.existsSync(targetPath)) {
      return { success: false, error: 'A file or folder with this name already exists' };
    }
    
    // Rename/move the file or folder
    fs.renameSync(sourcePath, targetPath);
    
    return { success: true };
  } catch (error) {
    console.error('Error renaming/moving file:', error);
    return { success: false, error: error.message };
  }
});

// Handle folder creation
ipcMain.handle('create-folder', async (event, data) => {
  try {
    const { path: folderPath, folderName } = data;
    if (!folderPath || !folderName) {
      return { success: false, error: 'Invalid parameters' };
    }
    
    // Get directories
    const { processedDir } = getDataDirectories();
    
    // Determine the actual folder name
    let actualFolderName = folderName;
    
    // Resolve path
    const targetPath = path.isAbsolute(folderPath) ? 
      path.join(folderPath, actualFolderName) : 
      path.join(processedDir, folderPath, actualFolderName);
    
    console.log(`Creating folder at: ${targetPath}`);
    
    // Check if folder already exists
    if (fs.existsSync(targetPath)) {
      return { success: false, error: 'A folder with this name already exists' };
    }
    
    // Create the folder
    fs.mkdirSync(targetPath, { recursive: true });
    
    return { success: true };
  } catch (error) {
    console.error('Error creating folder:', error);
    return { success: false, error: error.message };
  }
});
