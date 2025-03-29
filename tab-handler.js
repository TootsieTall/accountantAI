/**
 * Simple and robust tab handling script
 * This provides basic tab functionality regardless of any other script issues
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('Tab handler script loaded');
  
  // Get all tab elements
  const tabItems = document.querySelectorAll('.tab-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const settingsIcon = document.getElementById('settingsIcon');
  
  // Add click listeners to each tab
  tabItems.forEach(tab => {
    tab.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      console.log('Tab clicked:', tabId);
      
      // Results tab has special handling
      if (tabId === 'results') {
        const goToResultsBtn = document.getElementById('goToResultsBtn');
        if (goToResultsBtn && goToResultsBtn.disabled && document.querySelectorAll('#processingFilesList .file-item').length > 0) {
          console.log('Results tab is disabled until processing completes');
          showStatusMessage('Please complete processing before viewing results', 'error');
          return;
        }
      }
      
      // Update active tab
      tabItems.forEach(item => item.classList.remove('active'));
      this.classList.add('active');
      
      // Update active pane
      tabPanes.forEach(pane => pane.classList.remove('active'));
      document.getElementById(`${tabId}-tab`).classList.add('active');
      
      if (tabId === 'results') {
        // If going to results tab, try to load the file explorer
        try {
          if (window.loadFileExplorer) {
            window.loadFileExplorer('processed');
          }
        } catch (error) {
          console.error('Error loading file explorer:', error);
        }
      }
    });
  });
  
  // Make settings icon clickable
  if (settingsIcon) {
    settingsIcon.addEventListener('click', function() {
      console.log('Settings icon clicked');
      
      // Hide all tab panes
      tabPanes.forEach(pane => pane.classList.remove('active'));
      
      // Remove active class from all tabs
      tabItems.forEach(tab => tab.classList.remove('active'));
      
      // Show settings tab
      document.getElementById('settings-tab').classList.add('active');
      
      // Try to load API key if that function exists
      try {
        if (window.loadApiKey) {
          window.loadApiKey();
        }
      } catch (error) {
        console.error('Error loading API key:', error);
      }
    });
  }
  
  // Helper function to show status messages
  function showStatusMessage(message, type = '') {
    const statusMessage = document.getElementById('statusMessage');
    if (statusMessage) {
      statusMessage.textContent = message;
      statusMessage.className = 'status-message';
      
      if (type) {
        statusMessage.classList.add(type);
      }
    }
  }
  
  // Make these functions available to other scripts
  window.switchTabDirectly = function(tabId) {
    console.log('Direct tab switch to:', tabId);
    
    // Update active tab
    tabItems.forEach(item => {
      if (item.getAttribute('data-tab') === tabId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
    
    // Update active pane
    tabPanes.forEach(pane => {
      if (pane.id === `${tabId}-tab`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });
  };
  
  window.switchToSettingsTabDirectly = function() {
    // Hide all tab panes
    tabPanes.forEach(pane => pane.classList.remove('active'));
    
    // Remove active from all tabs
    tabItems.forEach(tab => tab.classList.remove('active'));
    
    // Show settings tab pane
    document.getElementById('settings-tab').classList.add('active');
  };
});
