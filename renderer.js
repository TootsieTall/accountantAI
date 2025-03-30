// DOM elements
const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const clientNameInput = document.getElementById('clientNameInput');
const importedFilesList = document.getElementById('importedFilesList');
const processBtn = document.getElementById('processBtn');
const processingFilesList = document.getElementById('processingFilesList');
const processingLog = document.getElementById('processingLog');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const goToResultsBtn = document.getElementById('goToResultsBtn');
const fileExplorer = document.getElementById('fileExplorer');
const currentPath = document.getElementById('currentPath');
const addFolderBtn = document.getElementById('addFolderBtn');
const settingsIcon = document.getElementById('settingsIcon');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKey = document.getElementById('toggleApiKey');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const statusMessage = document.getElementById('statusMessage');
const modalTemplate = document.getElementById('modalTemplate');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');

// Tab Navigation
const tabItems = document.querySelectorAll('.tab-item');
const tabPanes = document.querySelectorAll('.tab-pane');

// State
let importedFiles = [];
let processingFiles = [];
let currentDirectory = 'processed';
let currentProcessedFiles = 0;
let totalProcessedFiles = 0;

// ------------- INITIALIZATION -------------

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  console.log('Application initializing...');
  setupTabNavigation();
  setupDropArea();
  setupFileInput();
  setupProcessButton();
  setupResultsTab();
  setupSettingsTab();
  setupEventListeners();
  
  // Register event listeners from main process
  window.api.onProcessStatus(handleProcessStatus);
  window.api.onProcessResult(handleProcessResult);
  
  // Log initialization complete
  console.log('Application initialized successfully');
});

// ------------- TAB NAVIGATION -------------

function setupTabNavigation() {
  tabItems.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      
      // Special handling for results tab - only allow if processing is complete or no processing has occurred
      if (tabId === 'results') {
        if (!goToResultsBtn.disabled || totalProcessedFiles === 0) {
          switchTab(tabId);
          loadFileExplorer(currentDirectory);
        } else {
          showStatus('Please complete processing before viewing results', 'error');
        }
      } else {
        // For all other tabs, allow switching
        switchTab(tabId);
      }
    });
  });
}

function switchTab(tabId) {
  console.log(`Switching to tab: ${tabId}`);
  // Update active tab
  tabItems.forEach(item => {
    if (item.dataset.tab === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update active tab pane
  tabPanes.forEach(pane => {
    if (pane.id === `${tabId}-tab`) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });
}

// ------------- DROP AREA & FILE HANDLING -------------

function setupDropArea() {
  // Prevent default behavior for drag events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop area when dragging over it
  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });

  // Handle dropped files
  dropArea.addEventListener('drop', handleDrop, false);
  
  // Click to browse files
  dropArea.querySelector('.browse-link').addEventListener('click', () => {
    // Use the dialog API instead of the file input
    window.api.openFileDialog().then(filePaths => {
      console.log('File dialog result:', filePaths);
      if (filePaths && filePaths.length > 0) {
        // No need to call uploadFiles because the dialog handler already did this
        // Just update the UI
        showStatus(`Added ${filePaths.length} files from dialog`, 'success');
        
        // Simulate files for the UI
        const files = filePaths.map(path => {
          const fileName = path.split(/[/\\]/).pop(); // Get filename from path
          return {
            name: fileName,
            size: 0, // We don't have the size, but it's not critical
            path: path
          };
        });
        
        // Update imported files list
        importedFiles = [...importedFiles, ...files];
        updateImportedFilesList();
        
        // Also send file paths to main process
        window.api.uploadFiles(filePaths)
          .then(result => {
            console.log('Upload result:', result);
            if (result.failed === 0) {
              showStatus(`Successfully added ${result.success} files to source_documents folder`, 'success');
            } else {
              showStatus(`Added ${result.success} files. Failed to add ${result.failed} files.`, 
                       result.success > 0 ? 'warning' : 'error');
            }
          })
          .catch(err => {
            console.error('Error uploading files:', err);
            showStatus('Error uploading files: ' + err, 'error');
          });
      } else if (filePaths && filePaths.error) {
        showStatus(`Error opening file dialog: ${filePaths.error}`, 'error');
      }
    }).catch(error => {
      console.error('Error opening file dialog:', error);
      showStatus('Error opening file dialog', 'error');
    });
  });
}

function setupFileInput() {
  fileInput.addEventListener('change', e => {
    handleFiles(e.target.files);
  });
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight() {
  dropArea.classList.add('active');
}

function unhighlight() {
  dropArea.classList.remove('active');
}

function handleDrop(e) {
  console.log('Files dropped');
  const dt = e.dataTransfer;
  const files = dt.files;
  
  // If window.api is available, use it directly for dropped files
  if (window.api && files.length > 0) {
    // For Windows drag-and-drop fix
    if (files[0].path || files[0].webkitRelativePath) {
      const filePaths = Array.from(files).map(file => file.path || file.webkitRelativePath);
      
      if (filePaths.length > 0 && filePaths[0]) {
        console.log('Using file.path for drag and drop in Windows:', filePaths);
        
        // Update UI
        const uiFiles = filePaths.map(path => {
          return {
            name: path.split(/[/\\]/).pop(),
            size: 0,
            path: path
          };
        });
        
        importedFiles = [...importedFiles, ...uiFiles];
        updateImportedFilesList();
        
        // Send to main process
        window.api.uploadFiles(filePaths)
          .then(result => {
            console.log('Upload result:', result);
            if (result.failed === 0) {
              showStatus(`Successfully added ${result.success} files to source_documents folder`, 'success');
            } else {
              showStatus(`Added ${result.success} files. Failed to add ${result.failed} files.`, 
                       result.success > 0 ? 'warning' : 'error');
            }
          })
          .catch(err => {
            console.error('Error uploading files:', err);
            showStatus('Error uploading files: ' + err, 'error');
          });
        
        return;
      }
    }
  }
  
  // Fallback to the standard method
  handleFiles(files);
}

function handleFiles(fileList) {
  if (fileList.length === 0) {
    showStatus('No files selected', 'error');
    return;
  }
  
  // Filter only PDF files
  const pdfFiles = Array.from(fileList)
    .filter(file => file.name.toLowerCase().endsWith('.pdf'));
  
  if (pdfFiles.length === 0) {
    showStatus('No PDF files selected. Only PDF files are supported.', 'error');
    return;
  }

  // Add to imported files list
  importedFiles = [...importedFiles, ...pdfFiles];
  updateImportedFilesList();
  
  // Get file paths from files (for drag & drop from file system)
  const filePaths = [];
  for (const file of pdfFiles) {
    // For files from drag & drop, we should have a path property
    if (file.path) {
      filePaths.push(file.path);
      console.log('File path found:', file.path);
    } else {
      console.warn('No file path available for:', file.name);
    }
  }
  
  // Only send files to main process if paths are available
  if (filePaths.length > 0) {
    console.log('Sending file paths to main process:', filePaths);
    window.api.uploadFiles(filePaths)
      .then(result => {
        console.log('Upload result:', result);
        if (result.failed === 0) {
          showStatus(`Successfully added ${result.success} files to source_documents folder`, 'success');
        } else {
          showStatus(`Added ${result.success} files. Failed to add ${result.failed} files.`, 
                   result.success > 0 ? 'warning' : 'error');
        }
      })
      .catch(err => {
        console.error('Error uploading files:', err);
        showStatus('Error uploading files: ' + err, 'error');
      });
  } else {
    // If no paths available, just update the UI but log a warning
    showStatus(`Added ${pdfFiles.length} files to UI (but not to source_documents folder)`, 'warning');
    console.warn('No file paths available to save to source_documents. Use the browse button instead of drag and drop.');
  }
}

function updateImportedFilesList() {
  importedFilesList.innerHTML = '';
  
  if (importedFiles.length === 0) {
    importedFilesList.innerHTML = '<div class="empty-message">No files imported yet</div>';
    processBtn.disabled = true;
    return;
  }
  
  importedFiles.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    fileItem.innerHTML = `
      <div class="file-icon"><i class="fas fa-file-pdf"></i></div>
      <div class="file-name" title="${file.name}">${file.name}</div>
      <div class="file-size">${formatFileSize(file.size)}</div>
      <div class="file-actions">
        <button class="remove-file-btn" data-index="${index}"><i class="fas fa-times"></i></button>
      </div>
    `;
    
    // Add click handler to remove button
    const removeBtn = fileItem.querySelector('.remove-file-btn');
    removeBtn.addEventListener('click', () => {
      importedFiles.splice(index, 1);
      updateImportedFilesList();
    });
    
    importedFilesList.appendChild(fileItem);
  });
  
  // Enable process button if files are imported
  processBtn.disabled = importedFiles.length === 0;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ------------- DOCUMENT PROCESSING -------------
function setupProcessButton() {
  console.log('Setting up process button', processBtn);
  // Add click handler to process button
  processBtn.addEventListener('click', function(e) {
    console.log('Process button clicked!');
    startProcessing();
  });
    
  // Add reset checkpoint button - create it once during setup
  const resetBtn = document.createElement('button');
  resetBtn.className = 'secondary-btn';
  resetBtn.textContent = 'Reset Checkpoint';
  resetBtn.style.marginLeft = '10px';
  resetBtn.addEventListener('click', () => {
    window.api.resetCheckpoint()
      .then(result => {
        if (result.success) {
          showStatus('Checkpoint reset successfully. You can now process files again.', 'success');
        } else {
          showStatus(`Error resetting checkpoint: ${result.error}`, 'error');
        }
      });
  });
  
  document.querySelector('.action-buttons').appendChild(resetBtn);
}

function startProcessing() {
  console.log('Start processing function called');
  
  // Validate client name
  const clientName = clientNameInput.value.trim();
  console.log('Client name:', clientName);
  if (!clientName) {
    showStatus('Please enter a client name', 'error');
    clientNameInput.focus();
    return;
  }
  
  // Check if any files are imported
  console.log('Imported files count:', importedFiles.length);
  if (importedFiles.length === 0) {
    showStatus('No files imported. Please add files first.', 'error');
    return;
  }
  
  // Update processing data
  processingFiles = [...importedFiles];
  currentProcessedFiles = 0;
  totalProcessedFiles = processingFiles.length;
  
  // Setup UI
  updateProcessingList();
  updateProgressBar(0);
  processingLog.innerHTML = '';
  switchTab('processing');
  
  // Update button and show status
  processBtn.disabled = true;
  showStatus(`Starting document processing for client: ${clientName}`, 'running');
  
  // Add processing log entry
  addToProcessingLog(`Starting processing for client: ${clientName}`);
  addToProcessingLog(`Processing ${processingFiles.length} files`);
  
  // Check API key first
  window.api.getApiKey()
    .then(apiKey => {
      if (!apiKey || apiKey === 'your_api_key_here') {
        throw new Error('API key not set. Please configure in Settings.');
      }
      
      // Now call the processing function
      console.log('API key valid, starting document processing');
      return window.api.processDocuments(clientName);
    })
    .then(result => {
      console.log('Process started successfully:', result);
      addToProcessingLog('Processing has started successfully');
      
      // Monitor Python process output to detect completion
      const completionCheckInterval = setInterval(() => {
        // Check if we've seen "Processing complete" in the log
        const logEntries = processingLog.querySelectorAll('.log-entry');
        const isComplete = Array.from(logEntries).some(entry => 
          entry.textContent.includes('Completed processing:') || 
          entry.textContent.includes('Processing complete'));
          
        if (isComplete) {
          clearInterval(completionCheckInterval);
          // Enable Go To Results button
          goToResultsBtn.disabled = false;
          updateProgressBar(100);
          showStatus('Processing complete! You can now view the results.', 'success');
        }
      }, 1000); // Check every second
    })
    .catch(error => {
      console.error('Error starting document processing:', error);
      showStatus('Error: ' + (error.message || error), 'error');
      addToProcessingLog(`Error starting process: ${error.message || error}`, 'error');
      processBtn.disabled = false;
      
      // Check Python and show path diagnostics
      checkPythonStatus();
    });
}

// Helper function to add entries to processing log
function addToProcessingLog(message, type = 'info') {
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${type}`;
  
  const timestamp = new Date().toLocaleTimeString();
  logEntry.textContent = `[${timestamp}] ${message}`;
  
  processingLog.appendChild(logEntry);
  processingLog.scrollTop = processingLog.scrollHeight;
  
  // Check if this is a completion message and enable the Go To Results button
  if (message.includes('Processing complete') || 
      message.includes('Completed processing:') || 
      (message.includes('Processing') && message.includes('files') && message.includes('complete'))) {
    console.log('Completion message detected, enabling Go To Results button');
    goToResultsBtn.disabled = false;
    updateProgressBar(100);
  }
}

// Helper to check Python process status
function checkPythonStatus() {
  addToProcessingLog('Checking application status...', 'info');
  
  window.api.debugPaths()
    .then(result => {
      if (result?.success) {
        addToProcessingLog('Application paths are valid', 'info');
        
        // Check for each important directory
        const pathInfo = result.paths;
        for (const [key, info] of Object.entries(pathInfo)) {
          const status = info.exists ? 'exists' : 'missing';
          addToProcessingLog(`${key}: ${status} (${info.path})`, info.exists ? 'info' : 'error');
        }
      } else {
        addToProcessingLog('Failed to verify application paths', 'error');
      }
    })
    .catch(error => {
      addToProcessingLog(`Status check failed: ${error.message || error}`, 'error');
    });
}

// Function to update the processing files list
function updateProcessingList() {
  processingFilesList.innerHTML = '';
  
  processingFiles.forEach(file => {
    const fileItem = document.createElement('div');
    fileItem.className = 'processing-file-item';
    fileItem.dataset.filename = file.name;
    
    fileItem.innerHTML = `
      <div class="file-icon"><i class="fas fa-file-pdf"></i></div>
      <div class="file-name">${file.name}</div>
      <div class="file-status">Waiting</div>
    `;
    
    processingFilesList.appendChild(fileItem);
  });
}

// Function to update progress bar
function updateProgressBar(percent) {
  progressFill.style.width = `${percent}%`;
  progressText.textContent = `${Math.round(percent)}%`;
}

// Handle process status updates from main process
function handleProcessStatus(data) {
  console.log('Process status update:', data);
  
  if (data.type === 'progress') {
    currentProcessedFiles = data.current;
    const percent = (currentProcessedFiles / totalProcessedFiles) * 100;
    updateProgressBar(percent);
    
    // Update file status in list
    if (data.file) {
      addToProcessingLog(`Processing file: ${data.file}`);
      
      // Find the file item and update status
      const fileItems = processingFilesList.querySelectorAll('.processing-file-item');
      for (const item of fileItems) {
        if (item.dataset.filename === data.file) {
          const statusElement = item.querySelector('.file-status');
          statusElement.textContent = 'Processing';
          statusElement.classList.add('active');
          break;
        }
      }
    }
  } else if (data.type === 'complete') {
    updateProgressBar(100);
    addToProcessingLog('Processing complete!', 'success');
    goToResultsBtn.disabled = false;
    
    // Update all file statuses
    const fileItems = processingFilesList.querySelectorAll('.processing-file-item');
    for (const item of fileItems) {
      const statusElement = item.querySelector('.file-status');
      statusElement.textContent = 'Complete';
      statusElement.classList.remove('active');
      statusElement.classList.add('success');
    }
    
    showStatus('Processing complete! You can now view the results.', 'success');
  } else if (data.type === 'error') {
    addToProcessingLog(`Error: ${data.message}`, 'error');
    showStatus(`Error: ${data.message}`, 'error');
    
    // Enable the process button again
    processBtn.disabled = false;
    
    // Update file status if applicable
    if (data.file) {
      const fileItems = processingFilesList.querySelectorAll('.processing-file-item');
      for (const item of fileItems) {
        if (item.dataset.filename === data.file) {
          const statusElement = item.querySelector('.file-status');
          statusElement.textContent = 'Error';
          statusElement.classList.remove('active');
          statusElement.classList.add('error');
          break;
        }
      }
    }
  } else if (data.type === 'log') {
    addToProcessingLog(data.message, 'info');
  }
}

// Handle process result (when a specific file is complete)
function handleProcessResult(data) {
  console.log('Process result:', data);
  
  if (data.success) {
    // Update file status in list
    const fileItems = processingFilesList.querySelectorAll('.processing-file-item');
    for (const item of fileItems) {
      if (item.dataset.filename === data.file) {
        const statusElement = item.querySelector('.file-status');
        statusElement.textContent = 'Complete';
        statusElement.classList.remove('active');
        statusElement.classList.add('success');
        break;
      }
    }
    
    addToProcessingLog(`Completed processing: ${data.file}`, 'success');
    
    // If all files are processed, enable the Go To Results button
    if (document.querySelectorAll('.processing-file-item .file-status.success').length === processingFiles.length) {
      goToResultsBtn.disabled = false;
      updateProgressBar(100);
      addToProcessingLog('All files processed successfully!', 'success');
    }
  } else {
    // Update file status in list to show error
    const fileItems = processingFilesList.querySelectorAll('.processing-file-item');
    for (const item of fileItems) {
      if (item.dataset.filename === data.file) {
        const statusElement = item.querySelector('.file-status');
        statusElement.textContent = 'Error';
        statusElement.classList.remove('active');
        statusElement.classList.add('error');
        break;
      }
    }
    
    addToProcessingLog(`Error processing: ${data.file} - ${data.error}`, 'error');
  }
}

// ------------- RESULTS TAB -------------

function setupResultsTab() {
  goToResultsBtn.addEventListener('click', () => {
    console.log('Go To Results button clicked');
    switchTab('results');
    loadFileExplorer(currentDirectory);
  });
  
  addFolderBtn.addEventListener('click', showAddFolderModal);
  
  // Add debug button
  const debugBtn = document.createElement('button');
  debugBtn.className = 'icon-btn';
  debugBtn.title = 'Debug Paths';
  debugBtn.innerHTML = '<i class="fas fa-bug"></i>';
  debugBtn.style.marginLeft = '10px';
  debugBtn.addEventListener('click', () => {
    window.api.debugPaths()
      .then(result => {
        if (result.success) {
          console.log('Path debug info:', result);
          showStatus('Check console for path debug info', 'info');
          
          // Also display in a modal
          let content = '<h4>Directory Paths</h4>';
          for (const [key, info] of Object.entries(result.paths)) {
            content += `<p><strong>${key}:</strong> ${info.path}<br>
              Exists: ${info.exists ? '✓' : '✗'}<br>
              Contents: ${info.contents.join(', ') || '(empty)'}</p>`;
          }
          
          showModal('Debug Information', content, 'Close');
        } else {
          showStatus(`Debug error: ${result.error}`, 'error');
        }
      });
  });
  
  // Add the debug button to the results actions area
  document.querySelector('.results-actions').appendChild(debugBtn);
  
  // If we're in the processing tab and see a completed message, enable the Go To Results button
  const enableResultsButton = document.createElement('button');
  enableResultsButton.className = 'secondary-btn';
  enableResultsButton.textContent = 'Enable Results';
  enableResultsButton.style.marginLeft = '10px';
  enableResultsButton.addEventListener('click', () => {
    goToResultsBtn.disabled = false;
    showStatus('Results button enabled', 'success');
  });
  
  // Add to processing tab action buttons
  if (document.querySelector('#processing-tab .action-buttons')) {
    document.querySelector('#processing-tab .action-buttons').appendChild(enableResultsButton);
  }
}

function loadFileExplorer(dirPath) {
  console.log('Loading file explorer for path:', dirPath);
  
  // Show loading indicator
  fileExplorer.innerHTML = '<div class="loading-indicator">Loading...</div>';
  
  // Call main process to get directory contents
  window.api.getDirectoryContents(dirPath)
    .then(data => {
      console.log('Directory contents:', data);
      
      if (data.error) {
        showStatus(`Error loading directory: ${data.error}`, 'error');
        fileExplorer.innerHTML = `<div class="empty-message error">Error: ${data.error}</div>`;
        return;
      }
      
      // Update current directory
      currentDirectory = dirPath;
      
      // Update breadcrumb
      updateBreadcrumb(dirPath);
      
      // Update file explorer
      updateFileExplorer(data);
    })
    .catch(err => {
      console.error('Error loading directory:', err);
      showStatus('Error loading directory: ' + err, 'error');
      fileExplorer.innerHTML = `<div class="empty-message error">Error loading directory. Please try again.</div>`;
    });
}

function updateBreadcrumb(dirPath) {
  const parts = dirPath.split('/');
  let breadcrumbHtml = '<a href="#" data-path="">Home</a>';
  
  let currentPathStr = '';
  parts.forEach((part, index) => {
    if (part) {
      currentPathStr += (currentPathStr ? '/' : '') + part;
      
      if (index < parts.length - 1) {
        breadcrumbHtml += ` / <a href="#" data-path="${currentPathStr}">${part}</a>`;
      } else {
        breadcrumbHtml += ` / <span>${part}</span>`;
      }
    }
  });
  
  currentPath.innerHTML = breadcrumbHtml;
  
  // Add click handlers for breadcrumb links
  document.querySelectorAll('#currentPath a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pathToLoad = link.dataset.path || 'processed';
      loadFileExplorer(pathToLoad);
    });
  });
}

function updateFileExplorer(data) {
  fileExplorer.innerHTML = '';
  
  // First add all directories
  if (data.dirs && data.dirs.length > 0) {
    data.dirs.forEach(dir => {
      const folderItem = document.createElement('div');
      folderItem.className = 'folder-item';
      
      folderItem.innerHTML = `
        <div class="item-icon"><i class="fas fa-folder"></i></div>
        <div class="item-name">${dir}</div>
        <div class="item-actions">
          <button class="rename-btn" title="Rename" data-type="folder" data-name="${dir}"><i class="fas fa-pencil-alt"></i></button>
        </div>
      `;
      
      // Add click handler to open folder
      folderItem.addEventListener('click', (e) => {
        if (!e.target.classList.contains('rename-btn') && !e.target.closest('.rename-btn')) {
          const newPath = currentDirectory ? `${currentDirectory}/${dir}` : dir;
          loadFileExplorer(newPath);
        }
      });
      
      // Add click handler to rename button
      const renameBtn = folderItem.querySelector('.rename-btn');
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showRenameModal('folder', dir);
      });
      
      fileExplorer.appendChild(folderItem);
    });
  }
  
  // Then add all files
  if (data.files && data.files.length > 0) {
    data.files.forEach(file => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      
      // Determine file icon based on extension
      const fileExt = file.split('.').pop().toLowerCase();
      const fileIcon = fileExt === 'pdf' ? '<i class="fas fa-file-pdf"></i>' : 
                      fileExt === 'json' ? '<i class="fas fa-file-code"></i>' : 
                      '<i class="fas fa-file"></i>';
      
      fileItem.innerHTML = `
        <div class="item-icon">${fileIcon}</div>
        <div class="item-name">${file}</div>
        <div class="item-actions">
          <button class="rename-btn" title="Rename" data-type="file" data-name="${file}"><i class="fas fa-pencil-alt"></i></button>
        </div>
      `;
      
      // Add click handler to rename button
      const renameBtn = fileItem.querySelector('.rename-btn');
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showRenameModal('file', file);
      });
      
      fileExplorer.appendChild(fileItem);
    });
  }
  
  // Add empty message if no content
  if ((!data.dirs || data.dirs.length === 0) && (!data.files || data.files.length === 0)) {
    fileExplorer.innerHTML = '<div class="empty-message">This folder is empty</div>';
  }
}

function showAddFolderModal() {
  showModal('Add New Folder', `
    <div class="form-group">
      <label for="folderNameInput">Folder name:</label>
      <input type="text" id="folderNameInput" class="form-control" placeholder="New Folder">
    </div>
  `, 'Create', (modal) => {
    const folderName = modal.querySelector('#folderNameInput').value.trim();
    
    if (!folderName) {
      showStatus('Folder name cannot be empty', 'error');
      return false;
    }
    
    // Call main process to create folder
    return window.api.createFolder({
      path: currentDirectory,
      folderName: folderName
    })
    .then(result => {
      if (result.success) {
        showStatus('Folder created successfully', 'success');
        loadFileExplorer(currentDirectory);
        return true;
      } else {
        showStatus(`Error creating folder: ${result.error}`, 'error');
        return false;
      }
    })
    .catch(err => {
      showStatus('Error creating folder: ' + err, 'error');
      return false;
    });
  });
}

function showRenameModal(itemType, itemName) {
  showModal(`Rename ${itemType === 'folder' ? 'Folder' : 'File'}`, `
    <div class="form-group">
      <label for="newNameInput">New name:</label>
      <input type="text" id="newNameInput" class="form-control" value="${itemName}">
    </div>
  `, 'Rename', (modal) => {
    const newName = modal.querySelector('#newNameInput').value.trim();
    
    if (!newName) {
      showStatus('Name cannot be empty', 'error');
      return false;
    }
    
    if (newName === itemName) {
      return true; // No change needed
    }
    
    // Call main process to rename item
    return window.api.renameFile({
      oldPath: `${currentDirectory}/${itemName}`,
      newName: newName
    })
    .then(result => {
      if (result.success) {
        showStatus('Item renamed successfully', 'success');
        loadFileExplorer(currentDirectory);
        return true;
      } else {
        showStatus(`Error renaming item: ${result.error}`, 'error');
        return false;
      }
    })
    .catch(err => {
      showStatus('Error renaming item: ' + err, 'error');
      return false;
    });
  });
}

// ------------- SETTINGS TAB -------------

function setupSettingsTab() {
  settingsIcon.addEventListener('click', () => {
    switchToSettingsTab();
  });
  
  toggleApiKey.addEventListener('click', () => {
    const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    apiKeyInput.setAttribute('type', type);
    toggleApiKey.innerHTML = type === 'password' ? 
      '<i class="fas fa-eye"></i>' : 
      '<i class="fas fa-eye-slash"></i>';
  });
  
  saveSettingsBtn.addEventListener('click', saveSettings);
}

function switchToSettingsTab() {
  console.log('Switching to settings tab');
  
  // Hide all tab panes
  tabPanes.forEach(pane => {
    pane.classList.remove('active');
  });
  
  // Show settings tab pane
  document.getElementById('settings-tab').classList.add('active');
  
  // Remove active from all tabs
  tabItems.forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Load API key
  loadApiKey();
}

function loadApiKey() {
  window.api.getApiKey()
    .then(apiKey => {
      console.log('API key loaded');
      apiKeyInput.value = apiKey || '';
    })
    .catch(error => {
      console.error('Error loading API key:', error);
      showStatus('Error loading API key: ' + error, 'error');
    });
}

function saveSettings() {
  const apiKey = apiKeyInput.value.trim();
  
  if (!apiKey) {
    showStatus('API key cannot be empty', 'error');
    return;
  }
  
  console.log('Saving API key...');
  window.api.saveApiKey(apiKey)
    .then(success => {
      if (success) {
        showStatus('Settings saved successfully', 'success');
        // Go back to input tab
        switchTab('input');
      } else {
        showStatus('Failed to save settings', 'error');
      }
    })
    .catch(error => {
      console.error('Error saving settings:', error);
      showStatus('Error saving settings: ' + error, 'error');
    });
}

// ------------- UTILITY FUNCTIONS -------------

function setupEventListeners() {
  // Event listeners for window events, if needed
  window.addEventListener('error', (event) => {
    console.error('Runtime error:', event.error);
  });
}

function showStatus(message, type = '') {
  console.log(`Status: ${type} - ${message}`);
  
  statusMessage.textContent = message;
  statusMessage.className = 'status-message';
  
  if (type) {
    statusMessage.classList.add(type);
  }
  
  // Auto-clear success messages after 5 seconds
  if (type === 'success') {
    setTimeout(() => {
      if (statusMessage.textContent === message) {
        statusMessage.textContent = '';
        statusMessage.className = 'status-message';
      }
    }, 5000);
  }
}

function showModal(title, bodyContent, confirmText, onConfirm) {
  // Set modal content
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyContent;
  modalConfirmBtn.textContent = confirmText || 'Confirm';
  
  // Show modal
  modalTemplate.classList.add('visible');
  
  // Focus the first input if present
  setTimeout(() => {
    const firstInput = modalBody.querySelector('input');
    if (firstInput) {
      firstInput.focus();
      
      // If it's a rename input, select the name part without extension
      if (firstInput.id === 'newNameInput') {
        const value = firstInput.value;
        const lastDotIndex = value.lastIndexOf('.');
        if (lastDotIndex > 0) {
          firstInput.setSelectionRange(0, lastDotIndex);
        } else {
          firstInput.select();
        }
      }
    }
  }, 100);
  
  // Handle cancel
  modalCancelBtn.onclick = () => {
    modalTemplate.classList.remove('visible');
  };
  
  // Handle clicking outside modal to close
  modalTemplate.onclick = (e) => {
    if (e.target === modalTemplate) {
      modalTemplate.classList.remove('visible');
    }
  };
  
  // Handle confirm
  modalConfirmBtn.onclick = () => {
    // If onConfirm returns a promise, wait for it to resolve
    const result = onConfirm(modalTemplate);
    if (result instanceof Promise) {
      modalConfirmBtn.disabled = true;
      modalConfirmBtn.textContent = 'Processing...';
      
      result.then(success => {
        if (success) {
          modalTemplate.classList.remove('visible');
        }
        modalConfirmBtn.disabled = false;
        modalConfirmBtn.textContent = confirmText || 'Confirm';
      });
    } else if (result !== false) {
      modalTemplate.classList.remove('visible');
    }
  };
  
  // Handle Enter key in modal
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      modalConfirmBtn.click();
    } else if (e.key === 'Escape') {
      modalCancelBtn.click();
    }
  };
  
  document.addEventListener('keydown', handleKeyPress);
  
  // Remove event listener when modal is closed
  const onModalHidden = () => {
    if (!modalTemplate.classList.contains('visible')) {
      document.removeEventListener('keydown', handleKeyPress);
      modalTemplate.removeEventListener('transitionend', onModalHidden);
    }
  };
  
  modalTemplate.addEventListener('transitionend', onModalHidden);
}

// Add debugging function to help troubleshoot folder connections
function debugDirectoryPath(dirPath) {
  console.log('Debugging directory path:', dirPath);
  window.api.getDirectoryContents(dirPath)
    .then(data => {
      console.log('Debug directory contents:', data);
      showStatus(`Debug: ${dirPath} contains ${data.dirs?.length || 0} directories and ${data.files?.length || 0} files`, 'info');
    })
    .catch(err => {
      console.error('Debug directory error:', err);
      showStatus('Debug error: ' + err, 'error');
    });
}

// Function to refresh the current view
function refreshCurrentDirectory() {
  if (currentDirectory) {
    loadFileExplorer(currentDirectory);
  }
}
