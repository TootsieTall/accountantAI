// DOM elements
const fileExplorer = document.getElementById('fileExplorer');
const currentPath = document.getElementById('currentPath');
const addFolderBtn = document.getElementById('addFolderBtn');
const statusMessage = document.getElementById('statusMessage');
const previewContainer = document.getElementById('previewContainer');
const listViewBtn = document.getElementById('listViewBtn');
const gridViewBtn = document.getElementById('gridViewBtn');
const openResultsFolderBtn = document.getElementById('openResultsFolderBtn');

// State
let currentDirectory = 'processed';
let currentlyPreviewingFile = null;
let currentViewMode = 'list'; // Default to list view

// Initialize immediately and also when the document is loaded
initializeButtons();

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded event fired');
  initializeButtons();
  setupResultsTab();
});

// Also initialize on window load as a fallback
window.addEventListener('load', () => {
  console.log('Window load event fired');
  initializeButtons();
});

// Direct button click handlers as a fallback solution
function initializeButtons() {
  console.log('Initializing buttons directly');
  
  // Try to get references to buttons again
  const btnOpenFolder = document.getElementById('openResultsFolderBtn');
  const btnListView = document.getElementById('listViewBtn');
  const btnGridView = document.getElementById('gridViewBtn');
  
  console.log('Button references:', {
    'openResultsFolderBtn': btnOpenFolder,
    'listViewBtn': btnListView,
    'gridViewBtn': btnGridView
  });
  
  // Add direct onclick handlers as a fallback
  if (btnOpenFolder) {
    console.log('Adding direct onclick to Open Results Folder button');
    btnOpenFolder.onclick = function() {
      console.log('Open Results Folder button clicked (direct onclick)');
      openResultsFolder();
      return false;
    };
  }
  
  if (btnListView) {
    console.log('Adding direct onclick to List View button');
    btnListView.onclick = function() {
      console.log('List view button clicked (direct onclick)');
      setViewMode('list');
      return false;
    };
  }
  
  if (btnGridView) {
    console.log('Adding direct onclick to Grid View button');
    btnGridView.onclick = function() {
      console.log('Grid view button clicked (direct onclick)');
      setViewMode('grid');
      return false;
    };
  }
}

function setupResultsTab() {
  console.log('Setting up results tab...');
  
  // Add folder button event listener
  if (addFolderBtn) {
    addFolderBtn.addEventListener('click', showAddFolderDialog);
    console.log('Add folder button event listener attached');
  }
  
  // Set up view mode toggle buttons
  if (listViewBtn && gridViewBtn) {
    listViewBtn.addEventListener('click', function(e) {
      console.log('List view button clicked');
      setViewMode('list');
      e.stopPropagation();
    });
    
    gridViewBtn.addEventListener('click', function(e) {
      console.log('Grid view button clicked');
      setViewMode('grid');
      e.stopPropagation();
    });
    
    console.log('View toggle buttons event listeners attached');
  }
  
  // Set up Open Results Folder button event listener
  if (openResultsFolderBtn) {
    openResultsFolderBtn.addEventListener('click', function(e) {
      console.log('Open Results Folder button clicked');
      openResultsFolder();
      e.stopPropagation();
    });
    console.log('Open Results Folder button event listener attached');
  }
  
  // Load file explorer when Results tab is activated
  const resultsTabItem = document.querySelector('.tab-item[data-tab="results"]');
  if (resultsTabItem) {
    resultsTabItem.addEventListener('click', () => {
      loadFileExplorer(currentDirectory);
    });
  }
  
  // Also load it if we're already on the Results tab
  if (document.querySelector('.tab-item[data-tab="results"].active')) {
    loadFileExplorer(currentDirectory);
  }
  
  // Add close button event listener for preview
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('close-preview')) {
      closePreview();
    }
  });
}

function openResultsFolder() {
  console.log('openResultsFolder function called');
  console.log('Current directory:', currentDirectory);
  
  // Ensure the API is available
  if (!window.api || !window.api.openResultsFolder) {
    console.error('API not available or openResultsFolder method missing');
    showStatus('Error: API not available', 'error');
    return;
  }
  
  // Call the dedicated API function for opening folders
  try {
    window.api.openResultsFolder(currentDirectory)
      .then(result => {
        console.log('Open results folder result:', result);
        if (result.success) {
          showStatus('Opened results folder in file explorer', 'success');
        } else {
          showError(`Error opening folder: ${result.error}`);
        }
      })
      .catch(error => {
        console.error('Error opening results folder:', error);
        showError(`Error opening folder: ${error.message || error}`);
      });
  } catch (error) {
    console.error('Exception in openResultsFolder:', error);
    showError(`Error: ${error.message || error}`);
  }
}

function setViewMode(mode) {
  console.log(`Setting view mode to: ${mode}`);
  
  try {
    // Update the current view mode
    currentViewMode = mode;
    
    // Update the UI to reflect the current mode
    if (mode === 'list') {
      if (listViewBtn) listViewBtn.classList.add('active');
      if (gridViewBtn) gridViewBtn.classList.remove('active');
      if (fileExplorer) {
        fileExplorer.classList.add('list-view');
        fileExplorer.classList.remove('grid-view');
      }
      console.log('Applied list view classes');
    } else {
      if (gridViewBtn) gridViewBtn.classList.add('active');
      if (listViewBtn) listViewBtn.classList.remove('active');
      if (fileExplorer) {
        fileExplorer.classList.add('grid-view');
        fileExplorer.classList.remove('list-view');
      }
      console.log('Applied grid view classes');
    }
    
    // Force layout recalculation
    if (fileExplorer) fileExplorer.offsetHeight;
    
    // Reload the current directory with the new view mode
    loadFileExplorer(currentDirectory);
  } catch (error) {
    console.error('Error in setViewMode:', error);
  }
}

function loadFileExplorer(dirPath) {
  console.log('Loading file explorer for path:', dirPath);
  console.log('Current view mode:', currentViewMode);
  
  // Show loading indicator
  if (fileExplorer) {
    fileExplorer.innerHTML = '<div class="loading">Loading...</div>';
  }
  
  // Hide preview if open
  if (previewContainer && previewContainer.classList.contains('active')) {
    closePreview();
  }
  
  // Apply current view mode class
  if (fileExplorer) {
    if (currentViewMode === 'list') {
      fileExplorer.classList.add('list-view');
      fileExplorer.classList.remove('grid-view');
      if (listViewBtn) listViewBtn.classList.add('active');
      if (gridViewBtn) gridViewBtn.classList.remove('active');
    } else {
      fileExplorer.classList.add('grid-view');
      fileExplorer.classList.remove('list-view');
      if (gridViewBtn) gridViewBtn.classList.add('active');
      if (listViewBtn) listViewBtn.classList.remove('active');
    }
  }
  
  // Call the API to get directory contents
  window.api.getDirectoryContents(dirPath)
    .then(data => {
      console.log('Directory contents:', data);
      
      if (data.error) {
        showError(`Error loading directory: ${data.error}`);
        return;
      }
      
      // Log the actual path being used
      console.log('Full path being used:', data.fullPath);
      
      // Update current directory
      currentDirectory = dirPath;
      
      // Update breadcrumb navigation
      updateBreadcrumb(dirPath);
      
      // Display directory contents
      displayDirectoryContents(data);
      
      // Re-initialize buttons (just to be extra safe)
      initializeButtons();
    })
    .catch(error => {
      console.error('Error loading directory:', error);
      showError(`Error loading directory: ${error.message || error}`);
    });
}

// The rest of the file remains the same...

function updateBreadcrumb(dirPath) {
  // Split the path into segments
  const segments = dirPath.split('/').filter(segment => segment);
  
  // Start with Home link
  let breadcrumbHtml = '<a href="#" data-path="processed">Home</a>';
  
  // Build the full path incrementally
  let currentPathStr = '';
  
  segments.forEach((segment, index) => {
    currentPathStr += (currentPathStr ? '/' : '') + segment;
    
    if (index === segments.length - 1) {
      // Last segment is the current location (not a link)
      breadcrumbHtml += ` / <span>${segment}</span>`;
    } else {
      // Add intermediate links
      breadcrumbHtml += ` / <a href="#" data-path="${currentPathStr}">${segment}</a>`;
    }
  });
  
  // Update the breadcrumb element
  if (currentPath) {
    currentPath.innerHTML = breadcrumbHtml;
  }
  
  // Add click event listeners to all links in the breadcrumb
  document.querySelectorAll('#currentPath a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const path = link.getAttribute('data-path');
      loadFileExplorer(path);
    });
  });
}

function displayDirectoryContents(data) {
  // Clear the file explorer
  if (!fileExplorer) return;
  
  fileExplorer.innerHTML = '';
  
  // If there are no files or folders, show empty message
  if ((!data.dirs || data.dirs.length === 0) && (!data.files || data.files.length === 0)) {
    fileExplorer.innerHTML = '<div class="empty-message">This folder is empty</div>';
    return;
  }
  
  // Create a container for folders
  if (data.dirs && data.dirs.length > 0) {
    // Sort folders alphabetically
    data.dirs.sort((a, b) => a.localeCompare(b));
    
    // Create folder items
    data.dirs.forEach(folderName => {
      const folderItem = createFolderItem(folderName);
      fileExplorer.appendChild(folderItem);
    });
  }
  
  // Create a container for files
  if (data.files && data.files.length > 0) {
    // Sort files alphabetically
    data.files.sort((a, b) => a.localeCompare(b));
    
    // Create file items
    data.files.forEach(fileName => {
      const fileItem = createFileItem(fileName);
      fileExplorer.appendChild(fileItem);
    });
  }
  
  // Make items draggable
  setupDragAndDrop();
}

function createFolderItem(folderName) {
  const folderItem = document.createElement('div');
  folderItem.className = 'folder-item';
  folderItem.draggable = true;
  folderItem.dataset.name = folderName;
  folderItem.dataset.type = 'folder';
  
  folderItem.innerHTML = `
    <div class="item-icon"><i class="fas fa-folder"></i></div>
    <div class="item-name">${folderName}</div>
    <div class="item-actions">
      <button class="rename-btn" title="Rename"><i class="fas fa-pencil-alt"></i></button>
    </div>
  `;
  
  // Add double-click event to open folder
  folderItem.addEventListener('dblclick', () => {
    const newPath = currentDirectory ? `${currentDirectory}/${folderName}` : folderName;
    loadFileExplorer(newPath);
  });
  
  // Add single-click event to select
  folderItem.addEventListener('click', (e) => {
    // Only select if not clicking on a button
    if (!e.target.closest('button')) {
      // Deselect all items first
      document.querySelectorAll('.folder-item.selected, .file-item.selected').forEach(item => {
        item.classList.remove('selected');
      });
      
      // Select this item
      folderItem.classList.add('selected');
    }
  });
  
  // Add rename button event
  const renameBtn = folderItem.querySelector('.rename-btn');
  renameBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showRenameDialog('folder', folderName);
  });
  
  return folderItem;
}

function createFileItem(fileName) {
  const fileItem = document.createElement('div');
  fileItem.className = 'file-item';
  fileItem.draggable = true;
  fileItem.dataset.name = fileName;
  fileItem.dataset.type = 'file';
  
  // Determine appropriate icon based on file extension
  const extension = fileName.split('.').pop().toLowerCase();
  let iconClass = 'fa-file';
  
  if (extension === 'pdf') {
    iconClass = 'fa-file-pdf';
  } else if (['doc', 'docx'].includes(extension)) {
    iconClass = 'fa-file-word';
  } else if (['xls', 'xlsx', 'csv'].includes(extension)) {
    iconClass = 'fa-file-excel';
  } else if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
    iconClass = 'fa-file-image';
  } else if (['json', 'xml', 'html', 'js', 'css'].includes(extension)) {
    iconClass = 'fa-file-code';
  } else if (['zip', 'rar', '7z'].includes(extension)) {
    iconClass = 'fa-file-archive';
  }
  
  fileItem.innerHTML = `
    <div class="item-icon"><i class="fas ${iconClass}"></i></div>
    <div class="item-name">${fileName}</div>
    <div class="item-actions">
      <button class="rename-btn" title="Rename"><i class="fas fa-pencil-alt"></i></button>
      <button class="preview-btn" title="Preview"><i class="fas fa-eye"></i></button>
    </div>
  `;
  
  // Add click event to select
  fileItem.addEventListener('click', (e) => {
    // Only select if not clicking on a button
    if (!e.target.closest('button')) {
      // Deselect all items first
      document.querySelectorAll('.folder-item.selected, .file-item.selected').forEach(item => {
        item.classList.remove('selected');
      });
      
      // Select this item
      fileItem.classList.add('selected');
    }
  });
  
  // Add double-click event to preview file
  fileItem.addEventListener('dblclick', () => {
    openFileWithDefaultApp(fileName);
  });
  
  // Add rename button event
  const renameBtn = fileItem.querySelector('.rename-btn');
  renameBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showRenameDialog('file', fileName);
  });
  
  // Add preview button event
  const previewBtn = fileItem.querySelector('.preview-btn');
  if (previewBtn) { // Make sure preview button exists
    previewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openFileWithDefaultApp(fileName);
    });
  }
  
  return fileItem;
}

// New simplified approach - just open with system default app
function openFileWithDefaultApp(fileName) {
  const filePath = `${currentDirectory}/${fileName}`;
  console.log(`Opening file with default app: ${filePath}`);
  
  // Show status
  showStatus(`Opening ${fileName} with default viewer`, 'info');
  
  // Call the API to get file URL
  window.api.getFileUrl(filePath)
    .then(result => {
      if (!result.success) {
        console.error('Error opening file:', result.error);
        showStatus(`Error opening file: ${result.error}`, 'error');
      }
    })
    .catch(error => {
      console.error('Error opening file:', error);
      showStatus(`Error opening file: ${error.message || error}`, 'error');
    });
}

function closePreview() {
  if (previewContainer) {
    previewContainer.classList.remove('active');
    previewContainer.innerHTML = '';
    currentlyPreviewingFile = null;
    showStatus('Preview closed', 'info');
  }
}

function setupDragAndDrop() {
  const items = document.querySelectorAll('.folder-item, .file-item');
  
  items.forEach(item => {
    // Set up drag start event
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', item.dataset.name);
      e.dataTransfer.setData('application/accountantai-type', item.dataset.type);
      e.dataTransfer.effectAllowed = 'move';
      
      // Add dragging class
      item.classList.add('dragging');
    });
    
    // Clean up after drag
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
    
    // Only folders can be drop targets
    if (item.classList.contains('folder-item')) {
      // Allow drop
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        // Highlight drop target
        item.classList.add('drop-target');
      });
      
      // Remove highlight when leaving
      item.addEventListener('dragleave', () => {
        item.classList.remove('drop-target');
      });
      
      // Handle drop
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        
        // Remove highlight
        item.classList.remove('drop-target');
        
        // Get the dragged item name and type
        const sourceName = e.dataTransfer.getData('text/plain');
        const sourceType = e.dataTransfer.getData('application/accountantai-type');
        
        // Prevent dropping onto itself
        if (sourceName === item.dataset.name && sourceType === 'folder') {
          return;
        }
        
        // Get the target folder name
        const targetName = item.dataset.name;
        
        // Build source and destination paths
        const sourcePath = `${currentDirectory}/${sourceName}`;
        const destinationPath = `${currentDirectory}/${targetName}/${sourceName}`;
        
        // Call the rename-file IPC handler which can also move files/folders
        window.api.renameFile({
          oldPath: sourcePath,
          newPath: destinationPath
        }).then(result => {
          if (result.success) {
            // Reload the current directory to show changes
            loadFileExplorer(currentDirectory);
            showStatus(`Moved ${sourceName} to ${targetName}`, 'success');
          } else {
            showError(`Error moving item: ${result.error}`);
          }
        }).catch(error => {
          showError(`Error moving item: ${error.message || error}`);
        });
      });
    }
  });
}

function showAddFolderDialog() {
  // Create dialog container
  const dialogContainer = document.createElement('div');
  dialogContainer.className = 'dialog-container';
  
  // Create dialog content
  const dialog = document.createElement('div');
  dialog.className = 'dialog';
  
  dialog.innerHTML = `
    <h3>Create New Folder</h3>
    <div class="dialog-content">
      <div class="form-group">
        <label for="folderName">Folder Name:</label>
        <input type="text" id="folderName" class="form-control" placeholder="Enter folder name">
      </div>
    </div>
    <div class="dialog-buttons">
      <button class="dialog-btn cancel-btn">Cancel</button>
      <button class="dialog-btn create-btn">Create</button>
    </div>
  `;
  
  // Add dialog to container
  dialogContainer.appendChild(dialog);
  
  // Add container to document
  document.body.appendChild(dialogContainer);
  
  // Set up event listeners
  const folderNameInput = document.getElementById('folderName');
  const cancelBtn = dialog.querySelector('.cancel-btn');
  const createBtn = dialog.querySelector('.create-btn');
  
  // Focus on the input
  folderNameInput.focus();
  
  // Set up cancel button
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(dialogContainer);
  });
  
  // Set up create button
  createBtn.addEventListener('click', () => {
    const folderName = folderNameInput.value.trim();
    
    if (!folderName) {
      // Show error
      const errorMsg = document.createElement('div');
      errorMsg.className = 'dialog-error';
      errorMsg.textContent = 'Please enter a folder name';
      
      // Replace existing error or add new one
      const existingError = dialog.querySelector('.dialog-error');
      if (existingError) {
        dialog.replaceChild(errorMsg, existingError);
      } else {
        dialog.querySelector('.dialog-content').appendChild(errorMsg);
      }
      
      return;
    }
    
    // Call the create-folder IPC handler
    window.api.createFolder({
      path: currentDirectory,
      folderName
    }).then(result => {
      // Remove dialog
      document.body.removeChild(dialogContainer);
      
      if (result.success) {
        // Reload the current directory to show the new folder
        loadFileExplorer(currentDirectory);
        
        // Show success message
        showStatus('Folder created successfully', 'success');
      } else {
        showError(`Error creating folder: ${result.error}`);
      }
    }).catch(error => {
      document.body.removeChild(dialogContainer);
      showError(`Error creating folder: ${error.message || error}`);
    });
  });
  
  // Allow closing with Escape key
  document.addEventListener('keydown', function escListener(e) {
    if (e.key === 'Escape') {
      document.body.removeChild(dialogContainer);
      document.removeEventListener('keydown', escListener);
    }
  });
}

function showRenameDialog(itemType, itemName) {
  // Create dialog container
  const dialogContainer = document.createElement('div');
  dialogContainer.className = 'dialog-container';
  
  // Create dialog content
  const dialog = document.createElement('div');
  dialog.className = 'dialog';
  
  dialog.innerHTML = `
    <h3>Rename ${itemType === 'folder' ? 'Folder' : 'File'}</h3>
    <div class="dialog-content">
      <div class="form-group">
        <label for="newName">New Name:</label>
        <input type="text" id="newName" class="form-control" value="${itemName}">
      </div>
    </div>
    <div class="dialog-buttons">
      <button class="dialog-btn cancel-btn">Cancel</button>
      <button class="dialog-btn rename-btn">Rename</button>
    </div>
  `;
  
  // Add dialog to container
  dialogContainer.appendChild(dialog);
  
  // Add container to document
  document.body.appendChild(dialogContainer);
  
  // Set up event listeners
  const newNameInput = document.getElementById('newName');
  const cancelBtn = dialog.querySelector('.cancel-btn');
  const renameBtn = dialog.querySelector('.rename-btn');
  
  // Focus on the input and select the name part (without extension for files)
  newNameInput.focus();
  if (itemType === 'file') {
    const lastDotIndex = itemName.lastIndexOf('.');
    if (lastDotIndex > 0) {
      newNameInput.setSelectionRange(0, lastDotIndex);
    } else {
      newNameInput.select();
    }
  } else {
    newNameInput.select();
  }
  
  // Set up cancel button
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(dialogContainer);
  });
  
  // Set up rename button
  renameBtn.addEventListener('click', () => {
    const newName = newNameInput.value.trim();
    
    if (!newName) {
      // Show error
      const errorMsg = document.createElement('div');
      errorMsg.className = 'dialog-error';
      errorMsg.textContent = 'Please enter a name';
      
      // Replace existing error or add new one
      const existingError = dialog.querySelector('.dialog-error');
      if (existingError) {
        dialog.replaceChild(errorMsg, existingError);
      } else {
        dialog.querySelector('.dialog-content').appendChild(errorMsg);
      }
      
      return;
    }
    
    // Build the old path
    const oldPath = `${currentDirectory}/${itemName}`;
    
    // Call the rename-file IPC handler
    window.api.renameFile({
      oldPath,
      newName
    }).then(result => {
      // Remove dialog
      document.body.removeChild(dialogContainer);
      
      if (result.success) {
        // Reload the current directory to show the renamed item
        loadFileExplorer(currentDirectory);
        
        // Show success message
        showStatus(`${itemType === 'folder' ? 'Folder' : 'File'} renamed successfully`, 'success');
      } else {
        showError(`Error renaming ${itemType}: ${result.error}`);
      }
    }).catch(error => {
      document.body.removeChild(dialogContainer);
      showError(`Error renaming ${itemType}: ${error.message || error}`);
    });
  });
  
  // Allow closing with Escape key
  document.addEventListener('keydown', function escListener(e) {
    if (e.key === 'Escape') {
      document.body.removeChild(dialogContainer);
      document.removeEventListener('keydown', escListener);
    }
  });
}

function showError(message) {
  console.error(message);
  
  // Display error in file explorer
  if (fileExplorer) {
    fileExplorer.innerHTML = `<div class="error-message">${message}</div>`;
  }
  
  // Also update status message
  showStatus(message, 'error');
}

function showStatus(message, type = '') {
  if (!statusMessage) return;
  
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

// Make functions available globally for tab navigation
window.loadFileExplorer = loadFileExplorer;
window.openResultsFolder = openResultsFolder;
window.setViewMode = setViewMode;
