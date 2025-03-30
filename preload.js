const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // File operations
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  saveApiKey: (apiKey) => ipcRenderer.invoke('save-api-key', apiKey),
  uploadFiles: (filePaths) => {
    // Ensure we're passing an array of valid file paths
    if (!Array.isArray(filePaths)) {
      filePaths = [filePaths];
    }
    // Filter out any undefined or null paths
    const validPaths = filePaths.filter(path => path);
    return ipcRenderer.invoke('files-dropped', validPaths);
  },
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  processFiles: (filePaths) => ipcRenderer.invoke('process-files', filePaths),
  processDocuments: (clientName) => ipcRenderer.invoke('process-documents', clientName),
  getDirectoryContents: (dirPath) => ipcRenderer.invoke('get-directory-contents', dirPath),
  renameFile: (data) => ipcRenderer.invoke('rename-file', data),
  resetCheckpoint:() => ipcRenderer.invoke('resetCheckpoint'),
  createFolder: (data) => ipcRenderer.invoke('create-folder', data),
  debugPaths: () => ipcRenderer.invoke('debug-paths'),
  getFileUrl: (filePath) => ipcRenderer.invoke('get-file-url', filePath),
  openResultsFolder: (folderPath) => ipcRenderer.invoke('open-results-folder', folderPath),
  
  // Python process control
  startPython: (options) => ipcRenderer.invoke('start-python', options),
  stopPython: () => ipcRenderer.invoke('stop-python'),
  
  // Get data paths
  getDataPaths: () => ipcRenderer.invoke('get-data-paths'),
  
  // Event listeners
  onProcessStatus: (callback) => {
    ipcRenderer.on('process-status', (event, data) => callback(data));
  },
  onProcessResult: (callback) => {
    ipcRenderer.on('process-result', (event, data) => callback(data));
  },
  onPythonOutput: (callback) => {
    ipcRenderer.on('python-output', (event, data) => callback(data));
  },
  onPythonError: (callback) => {
    ipcRenderer.on('python-error', (event, data) => callback(data));
  },
  onPythonExit: (callback) => {
    ipcRenderer.on('python-exit', (event, code) => callback(code));
  },
  
  // Remove event listeners when they're no longer needed
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('process-status');
    ipcRenderer.removeAllListeners('process-result');
    ipcRenderer.removeAllListeners('python-output');
    ipcRenderer.removeAllListeners('python-error');
    ipcRenderer.removeAllListeners('python-exit');
  }
});
