// Popup script for Comet DevTools
const btnOpen = document.getElementById('btnOpen');
const errorDiv = document.getElementById('error');

btnOpen.addEventListener('click', async () => {
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.id) {
      showError('No active tab found');
      return;
    }

    // Check if it's a restricted page
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('about:')) {
      showError('Cannot run on browser internal pages. Navigate to a regular website first.');
      return;
    }

    // Ask background to inject and show
    const response = await chrome.runtime.sendMessage({
      type: 'INJECT_AND_SHOW',
      tabId: tab.id
    });

    if (response?.success) {
      window.close(); // Close popup after opening overlay
    } else {
      showError(response?.error || 'Failed to open overlay');
    }
  } catch (error) {
    showError(error.message);
  }
});

function showError(message) {
  errorDiv.textContent = message;
  errorDiv.classList.add('visible');
}
