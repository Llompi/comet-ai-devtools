/**
 * Comet AI DevTools Bridge - Background Service Worker
 * Simplified version that handles keyboard commands and coordinates with content script
 */

// Handle keyboard command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-devtools') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Send message to content script to toggle overlay
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
      } catch (error) {
        // Content script might not be loaded, inject it
        console.log('[DevTools Bridge] Injecting content script...');
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-script.js']
        });
        // Try again
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
          } catch (e) {
            console.error('[DevTools Bridge] Failed to toggle:', e);
          }
        }, 100);
      }
    }
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INJECT_AND_SHOW') {
    handleInjectAndShow(message.tabId).then(sendResponse);
    return true;
  }
  
  if (message.type === 'GET_TAB_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      sendResponse({ tabId: tab?.id, url: tab?.url });
    });
    return true;
  }
});

async function handleInjectAndShow(tabId) {
  try {
    // Try to send message first
    await chrome.tabs.sendMessage(tabId, { type: 'SHOW_OVERLAY' });
    return { success: true };
  } catch (error) {
    // Inject content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-script.js']
      });
      
      // Wait a moment for script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Send show command
      await chrome.tabs.sendMessage(tabId, { type: 'SHOW_OVERLAY' });
      return { success: true };
    } catch (injectError) {
      console.error('[DevTools Bridge] Injection failed:', injectError);
      return { success: false, error: injectError.message };
    }
  }
}

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[DevTools Bridge] Extension ${details.reason}: v${chrome.runtime.getManifest().version}`);
});

console.log('[DevTools Bridge] Background service worker initialized');
