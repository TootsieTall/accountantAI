const path = require('path');
const fs = require('fs');
const os = require('os');

// Import our directory helper
let initDirectories;
try {
  initDirectories = require('./init-directories');
} catch (e) {
  // Handle case where init-directories.js isn't available yet
  console.error('Error importing init-directories.js:', e);
  initDirectories = { 
    getAppDataDirectory: () => {
      if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'AccountantAI');
      } else if (process.platform === 'win32') {
        // Use %APPDATA% on Windows instead of installation directory
        return process.env.APPDATA ? path.join(process.env.APPDATA, 'AccountantAI') : 
               path.join(os.homedir(), 'AppData', 'Roaming', 'AccountantAI');
      } else {
        return path.join(os.homedir(), '.accountantai');
      }
    }
  };
}

/**
 * Utility functions for handling file paths and directory operations
 */
class PathHandler {
  constructor() {
    this.appRoot = this.getAppRoot();
  }

  /**
   * Get the application root directory
   * @returns {string} Path to the application root
   */
  getAppRoot() {
    // Use platform-specific app data directory
    try {
      return initDirectories.getAppDataDirectory();
    } catch (e) {
      // In development, use current directory
      if (process.env.NODE_ENV === 'development') {
        return process.cwd();
      }
      
      // In production, use appropriate platform-specific directory
      if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'AccountantAI');
      } else if (process.platform === 'win32') {
        return process.env.APPDATA ? path.join(process.env.APPDATA, 'AccountantAI') : 
               path.join(os.homedir(), 'AppData', 'Roaming', 'AccountantAI');
      } else {
        return path.join(os.homedir(), '.accountantai');
      }
    }
  }

  /**
   * Normalize a file path for cross-platform compatibility
   * @param {string} filePath - Path to normalize
   * @returns {string} Normalized path
   */
  normalizePath(filePath) {
    return path.normalize(filePath);
  }

  /**
   * Join paths in a cross-platform compatible way
   * @param  {...string} parts - Path segments to join
   * @returns {string} Joined path
   */
  joinPath(...parts) {
    return path.join(...parts);
  }

  /**
   * Ensure a directory exists, creating it if necessary
   * @param {string} dirPath - Directory to check/create
   */
  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Safely copy a file with error handling
   * @param {string} source - Source file path
   * @param {string} destination - Destination file path
   * @returns {boolean} True if successful, false otherwise
   */
  safeFileCopy(source, destination) {
    try {
      // Ensure destination directory exists
      this.ensureDirectoryExists(path.dirname(destination));
      
      // Check if source exists
      if (!fs.existsSync(source)) {
        console.error(`Source file does not exist: ${source}`);
        return false;
      }
      
      // Copy the file
      fs.copyFileSync(source, destination);
      return true;
    } catch (error) {
      console.error(`Error copying file from ${source} to ${destination}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get a list of files in a directory with a specific extension
   * @param {string} dirPath - Directory to scan
   * @param {string} extension - File extension to filter (e.g., '.pdf')
   * @returns {Array<string>} Array of file paths
   */
  getFilesWithExtension(dirPath, extension) {
    try {
      if (!fs.existsSync(dirPath)) {
        return [];
      }
      
      return fs.readdirSync(dirPath)
        .filter(file => file.toLowerCase().endsWith(extension.toLowerCase()))
        .map(file => path.join(dirPath, file));
    } catch (error) {
      console.error(`Error reading directory ${dirPath}: ${error.message}`);
      return [];
    }
  }

  /**
   * Recursively scan a directory for files with a specific extension
   * @param {string} dirPath - Directory to scan
   * @param {string} extension - File extension to filter (e.g., '.pdf')
   * @returns {Array<string>} Array of file paths
   */
  scanDirectoryRecursive(dirPath, extension) {
    try {
      let results = [];
      
      if (!fs.existsSync(dirPath)) {
        return results;
      }
      
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          results = results.concat(this.scanDirectoryRecursive(itemPath, extension));
        } else if (item.toLowerCase().endsWith(extension.toLowerCase())) {
          results.push(itemPath);
        }
      }
      
      return results;
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}: ${error.message}`);
      return [];
    }
  }
}

module.exports = new PathHandler();
