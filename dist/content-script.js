/**
 * Comet AI DevTools Bridge - Loader
 * Injects the core logic into the Main World and bridges messages.
 */

// 1. Inject the Core Script into the Main World
const script = document.createElement('script');
script.src = chrome.runtime.getURL('comet-core.js');
script.onload = function() {
  this.remove(); // Clean up the script tag
};
(document.head || document.documentElement).appendChild(script);

// 2. Bridge: Listen for Background Messages -> Forward to Main World
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Forward message to the Main World
  window.postMessage({
    source: 'COMET_BRIDGE_TO_MAIN',
    type: message.type,
    payload: message
  }, '*');

  // Acknowledge receipt to keep the popup happy
  sendResponse({ success: true });
  return true;
});

console.log('[Comet Bridge] Core injected into main world');
