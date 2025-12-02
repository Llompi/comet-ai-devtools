/**
 * Comet AI DevTools Bridge - Content Script Overlay
 * v1.2 - Cross-tab sync, persistence, and tab group awareness
 */

// Avoid double injection
if (window.__cometDevToolsInjected) {
  console.log('[Comet DevTools] Already injected');
} else {
  window.__cometDevToolsInjected = true;

  // ============================================
  // Constants
  // ============================================
  
  const STORAGE_KEY = 'cometDevToolsState';
  const SYNC_CHANNEL_NAME = 'comet-devtools-sync';
  const SESSION_KEY = 'cometDevToolsSession';
  
  // ============================================
  // State
  // ============================================
  
  const state = {
    isVisible: false,
    isMinimized: false,
    isMonitoring: false,
    activeTab: 'console',
    consoleLogs: [],
    networkRequests: [],
    consoleOriginals: {},
    // Sync settings
    syncEnabled: false,
    syncGroupId: null,
    tabId: generateTabId(),
    // Background operation
    isBackgrounded: false,
  };
  
  // BroadcastChannel for cross-tab communication
  let syncChannel = null;
  
  // ============================================
  // Tab/Session ID Generation
  // ============================================
  
  function generateTabId() {
    // Persistent per-tab ID (survives refresh)
    let tabId = sessionStorage.getItem('cometDevToolsTabId');
    if (!tabId) {
      tabId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('cometDevToolsTabId', tabId);
    }
    return tabId;
  }
  
  // ============================================
  // Persistence (survives regular refresh)
  // ============================================
  
  function saveState() {
    try {
      const persistData = {
        isVisible: state.isVisible,
        isMinimized: state.isMinimized,
        isMonitoring: state.isMonitoring,
        activeTab: state.activeTab,
        consoleLogs: state.consoleLogs.slice(-200), // Limit stored logs
        networkRequests: state.networkRequests.slice(-100),
        syncEnabled: state.syncEnabled,
        syncGroupId: state.syncGroupId,
        savedAt: Date.now(),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistData));
    } catch (e) {
      console.warn('[Comet DevTools] Failed to save state:', e);
    }
  }
  
  function loadState() {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        // Check if saved less than 1 hour ago (prevents stale data)
        if (data.savedAt && Date.now() - data.savedAt < 3600000) {
          state.isVisible = data.isVisible || false;
          state.isMinimized = data.isMinimized || false;
          state.isMonitoring = data.isMonitoring || false;
          state.activeTab = data.activeTab || 'console';
          state.consoleLogs = data.consoleLogs || [];
          state.networkRequests = data.networkRequests || [];
          state.syncEnabled = data.syncEnabled || false;
          state.syncGroupId = data.syncGroupId || null;
          return true;
        }
      }
    } catch (e) {
      console.warn('[Comet DevTools] Failed to load state:', e);
    }
    return false;
  }
  
  function hardReset() {
    // Clear all persisted state
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem('cometDevToolsTabId');
    
    // Reset in-memory state
    state.consoleLogs = [];
    state.networkRequests = [];
    state.isMonitoring = false;
    state.syncEnabled = false;
    state.syncGroupId = null;
    
    // Broadcast reset to other tabs
    if (syncChannel) {
      syncChannel.postMessage({
        type: 'HARD_RESET',
        from: state.tabId,
        groupId: state.syncGroupId,
      });
    }
    
    // Update UI
    updateConsoleDisplay();
    updateNetworkDisplay();
    updateSyncUI();
    
    if (state.isMonitoring) {
      toggleMonitoring();
    }
    
    console.log('[Comet DevTools] Hard reset complete');
  }
  
  // ============================================
  // Cross-Tab Sync
  // ============================================
  
  function initSyncChannel() {
    try {
      syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      
      syncChannel.onmessage = (event) => {
        const msg = event.data;
        
        // Ignore messages from self
        if (msg.from === state.tabId) return;
        
        // If we're in a group, only respond to same group
        if (state.syncGroupId && msg.groupId && msg.groupId !== state.syncGroupId) {
          return;
        }
        
        // Only process if sync is enabled (unless it's a sync enable message)
        if (!state.syncEnabled && msg.type !== 'SYNC_ENABLE' && msg.type !== 'REQUEST_STATE') {
          return;
        }
        
        handleSyncMessage(msg);
      };
      
      console.log('[Comet DevTools] Sync channel initialized');
    } catch (e) {
      console.warn('[Comet DevTools] BroadcastChannel not supported:', e);
    }
  }
  
  function handleSyncMessage(msg) {
    switch (msg.type) {
      case 'SYNC_ENABLE':
        if (msg.groupId === state.syncGroupId || !state.syncGroupId) {
          state.syncEnabled = true;
          state.syncGroupId = msg.groupId;
          updateSyncUI();
          saveState();
        }
        break;
        
      case 'SYNC_DISABLE':
        if (msg.groupId === state.syncGroupId) {
          state.syncEnabled = false;
          updateSyncUI();
          saveState();
        }
        break;
        
      case 'CONSOLE_LOG':
        if (state.syncEnabled) {
          // Avoid duplicates by checking ID
          if (!state.consoleLogs.find(l => l.id === msg.log.id)) {
            state.consoleLogs.push(msg.log);
            if (state.consoleLogs.length > 500) state.consoleLogs.shift();
            updateConsoleDisplay();
            saveState();
          }
        }
        break;
        
      case 'NETWORK_REQUEST':
        if (state.syncEnabled) {
          const existing = state.networkRequests.find(r => r.id === msg.request.id);
          if (existing) {
            Object.assign(existing, msg.request);
          } else {
            state.networkRequests.push(msg.request);
            if (state.networkRequests.length > 200) state.networkRequests.shift();
          }
          updateNetworkDisplay();
          saveState();
        }
        break;
        
      case 'MONITORING_START':
        if (state.syncEnabled && !state.isMonitoring) {
          state.isMonitoring = true;
          updateMonitoringUI();
          saveState();
        }
        break;
        
      case 'MONITORING_STOP':
        if (state.syncEnabled && state.isMonitoring) {
          state.isMonitoring = false;
          updateMonitoringUI();
          saveState();
        }
        break;
        
      case 'CLEAR_LOGS':
        if (state.syncEnabled) {
          state.consoleLogs = [];
          state.networkRequests = [];
          updateConsoleDisplay();
          updateNetworkDisplay();
          saveState();
        }
        break;
        
      case 'HARD_RESET':
        if (state.syncEnabled || msg.groupId === state.syncGroupId) {
          sessionStorage.removeItem(STORAGE_KEY);
          state.consoleLogs = [];
          state.networkRequests = [];
          state.isMonitoring = false;
          state.syncEnabled = false;
          updateConsoleDisplay();
          updateNetworkDisplay();
          updateMonitoringUI();
          updateSyncUI();
        }
        break;
        
      case 'REQUEST_STATE':
        // Another tab is asking for current state (for new tabs joining a group)
        if (state.syncEnabled && state.syncGroupId === msg.groupId) {
          broadcastFullState();
        }
        break;
        
      case 'FULL_STATE':
        // Receiving full state from another tab
        if (msg.groupId === state.syncGroupId) {
          state.consoleLogs = msg.state.consoleLogs || [];
          state.networkRequests = msg.state.networkRequests || [];
          state.isMonitoring = msg.state.isMonitoring || false;
          updateConsoleDisplay();
          updateNetworkDisplay();
          updateMonitoringUI();
          saveState();
        }
        break;
        
      case 'SHOW_OVERLAY':
        if (state.syncEnabled) {
          showOverlay();
        }
        break;
        
      case 'HIDE_OVERLAY':
        if (state.syncEnabled) {
          hideOverlay();
        }
        break;
    }
  }
  
  function broadcastSync(type, data = {}) {
    if (syncChannel && state.syncEnabled) {
      syncChannel.postMessage({
        type,
        from: state.tabId,
        groupId: state.syncGroupId,
        timestamp: Date.now(),
        ...data,
      });
    }
  }
  
  function broadcastFullState() {
    if (syncChannel) {
      syncChannel.postMessage({
        type: 'FULL_STATE',
        from: state.tabId,
        groupId: state.syncGroupId,
        state: {
          consoleLogs: state.consoleLogs,
          networkRequests: state.networkRequests,
          isMonitoring: state.isMonitoring,
        },
      });
    }
  }
  
  function enableSync(groupId = null) {
    state.syncEnabled = true;
    state.syncGroupId = groupId || 'default-' + Date.now();
    
    if (syncChannel) {
      syncChannel.postMessage({
        type: 'SYNC_ENABLE',
        from: state.tabId,
        groupId: state.syncGroupId,
      });
      
      // Request current state from other tabs
      syncChannel.postMessage({
        type: 'REQUEST_STATE',
        from: state.tabId,
        groupId: state.syncGroupId,
      });
    }
    
    updateSyncUI();
    saveState();
    console.log('[Comet DevTools] Sync enabled, group:', state.syncGroupId);
  }
  
  function disableSync() {
    broadcastSync('SYNC_DISABLE');
    state.syncEnabled = false;
    updateSyncUI();
    saveState();
    console.log('[Comet DevTools] Sync disabled');
  }
  
  function updateSyncUI() {
    const syncBtn = document.getElementById('cdt-btn-sync');
    const syncStatus = document.getElementById('cdt-sync-status');
    
    if (syncBtn) {
      syncBtn.textContent = state.syncEnabled ? '🔗 Synced' : '🔗 Sync Tabs';
      syncBtn.classList.toggle('active', state.syncEnabled);
    }
    
    if (syncStatus) {
      syncStatus.style.display = state.syncEnabled ? 'inline' : 'none';
      syncStatus.textContent = state.syncEnabled ? `Group: ${state.syncGroupId?.substring(0, 8)}...` : '';
    }
  }

  // ============================================
  // Console Interceptor
  // ============================================

  function interceptConsole() {
    const methods = ['log', 'info', 'warn', 'error', 'debug'];
    
    methods.forEach(method => {
      state.consoleOriginals[method] = console[method].bind(console);
      
      console[method] = (...args) => {
        // Call original
        state.consoleOriginals[method](...args);
        
        // Capture if monitoring
        if (state.isMonitoring) {
          const entry = {
            id: state.tabId + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            type: method,
            message: args.map(arg => {
              try {
                if (typeof arg === 'object') return JSON.stringify(arg);
                return String(arg);
              } catch {
                return String(arg);
              }
            }).join(' '),
            timestamp: Date.now(),
            source: new Error().stack?.split('\n')[2]?.trim() || '',
            tabId: state.tabId,
            url: window.location.href,
          };
          
          state.consoleLogs.push(entry);
          if (state.consoleLogs.length > 500) {
            state.consoleLogs.shift();
          }
          
          // Broadcast to synced tabs
          broadcastSync('CONSOLE_LOG', { log: entry });
          
          updateConsoleDisplay();
          saveState();
        }
      };
    });
  }

  // ============================================
  // Network Interceptor
  // ============================================

  function interceptNetwork() {
    // Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = Date.now();
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || 'unknown';
      const method = args[1]?.method || 'GET';
      
      const entry = {
        id: state.tabId + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        url,
        method,
        type: 'fetch',
        status: 0,
        statusText: 'pending',
        startTime,
        duration: null,
        size: null,
        tabId: state.tabId,
        pageUrl: window.location.href,
      };
      
      if (state.isMonitoring) {
        state.networkRequests.push(entry);
        if (state.networkRequests.length > 200) {
          state.networkRequests.shift();
        }
        broadcastSync('NETWORK_REQUEST', { request: entry });
        updateNetworkDisplay();
        saveState();
      }
      
      try {
        const response = await originalFetch(...args);
        entry.status = response.status;
        entry.statusText = response.statusText;
        entry.duration = Date.now() - startTime;
        broadcastSync('NETWORK_REQUEST', { request: entry });
        updateNetworkDisplay();
        saveState();
        return response;
      } catch (error) {
        entry.status = 0;
        entry.statusText = 'Error: ' + error.message;
        entry.duration = Date.now() - startTime;
        broadcastSync('NETWORK_REQUEST', { request: entry });
        updateNetworkDisplay();
        saveState();
        throw error;
      }
    };

    // Intercept XHR
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this._cometDevTools = { method, url, startTime: null };
      return originalXHROpen.call(this, method, url, ...rest);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
      if (this._cometDevTools && state.isMonitoring) {
        this._cometDevTools.startTime = Date.now();
        
        const entry = {
          id: state.tabId + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          url: this._cometDevTools.url,
          method: this._cometDevTools.method,
          type: 'xhr',
          status: 0,
          statusText: 'pending',
          startTime: this._cometDevTools.startTime,
          duration: null,
          size: null,
          tabId: state.tabId,
          pageUrl: window.location.href,
        };
        
        state.networkRequests.push(entry);
        if (state.networkRequests.length > 200) {
          state.networkRequests.shift();
        }
        
        broadcastSync('NETWORK_REQUEST', { request: entry });
        
        this.addEventListener('load', () => {
          entry.status = this.status;
          entry.statusText = this.statusText;
          entry.duration = Date.now() - entry.startTime;
          entry.size = this.responseText?.length || 0;
          broadcastSync('NETWORK_REQUEST', { request: entry });
          updateNetworkDisplay();
          saveState();
        });
        
        this.addEventListener('error', () => {
          entry.status = 0;
          entry.statusText = 'Network Error';
          entry.duration = Date.now() - entry.startTime;
          broadcastSync('NETWORK_REQUEST', { request: entry });
          updateNetworkDisplay();
          saveState();
        });
        
        updateNetworkDisplay();
        saveState();
      }
      
      return originalXHRSend.call(this, ...args);
    };
  }

  // ============================================
  // UI Creation
  // ============================================

  function createOverlay() {
    // Remove existing if present
    const existing = document.getElementById('comet-devtools-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'comet-devtools-overlay';
    overlay.setAttribute('data-comet-devtools', 'true');
    
    overlay.innerHTML = `
      <style>
        #comet-devtools-overlay {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 600px;
          max-width: calc(100vw - 40px);
          height: 400px;
          max-height: calc(100vh - 100px);
          background: #1e1e1e;
          border: 2px solid #4fc3f7;
          border-radius: 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px;
          color: #e0e0e0;
          z-index: 2147483647;
          display: none;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          overflow: hidden;
        }
        
        #comet-devtools-overlay.visible {
          display: flex;
        }
        
        #comet-devtools-overlay.minimized {
          width: auto !important;
          height: auto !important;
          min-width: 0;
          min-height: 0;
          padding: 0;
          border-radius: 24px;
        }
        
        #comet-devtools-overlay.minimized .cdt-header,
        #comet-devtools-overlay.minimized .cdt-tabs,
        #comet-devtools-overlay.minimized .cdt-content,
        #comet-devtools-overlay.minimized .cdt-footer,
        #comet-devtools-overlay.minimized .cdt-resize-handle {
          display: none !important;
        }
        
        .cdt-minimized-view {
          display: none;
          padding: 8px 12px;
          cursor: pointer;
          align-items: center;
          gap: 8px;
        }
        
        #comet-devtools-overlay.minimized .cdt-minimized-view {
          display: flex;
        }
        
        .cdt-mini-icon {
          font-size: 16px;
        }
        
        .cdt-mini-status {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
        }
        
        .cdt-mini-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #666;
        }
        
        .cdt-mini-dot.active {
          background: #81c784;
          box-shadow: 0 0 4px #81c784;
        }
        
        .cdt-mini-dot.synced {
          background: #4fc3f7;
          box-shadow: 0 0 4px #4fc3f7;
        }
        
        .cdt-mini-counts {
          font-size: 10px;
          color: #888;
        }
        
        .cdt-mini-counts .errors {
          color: #e57373;
        }
        
        .cdt-backgrounded-indicator {
          display: none;
          position: absolute;
          top: -8px;
          right: -8px;
          background: #ff9800;
          color: #1e1e1e;
          font-size: 9px;
          padding: 2px 6px;
          border-radius: 8px;
          font-weight: 600;
        }
        
        #comet-devtools-overlay.backgrounded .cdt-backgrounded-indicator {
          display: block;
        }
        
        #comet-devtools-overlay * {
          box-sizing: border-box;
        }
        
        .cdt-header {
          display: flex;
          align-items: center;
          padding: 10px 14px;
          background: #2d2d2d;
          border-bottom: 1px solid #444;
          gap: 10px;
        }
        
        .cdt-title {
          font-weight: 600;
          color: #4fc3f7;
          flex: 1;
        }
        
        .cdt-status {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: #3c3c3c;
          border-radius: 12px;
          font-size: 11px;
        }
        
        .cdt-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #666;
        }
        
        .cdt-status-dot.active {
          background: #81c784;
          box-shadow: 0 0 6px #81c784;
        }
        
        .cdt-btn {
          padding: 6px 12px;
          border: 1px solid #555;
          border-radius: 6px;
          background: #3c3c3c;
          color: #e0e0e0;
          font-size: 12px;
          cursor: pointer;
        }
        
        .cdt-btn:hover {
          background: #4a4a4a;
        }
        
        .cdt-btn.primary {
          background: #4fc3f7;
          color: #1e1e1e;
          border-color: #4fc3f7;
        }
        
        .cdt-btn.primary:hover {
          background: #29b6f6;
        }
        
        .cdt-btn.active {
          background: #81c784;
          color: #1e1e1e;
          border-color: #81c784;
        }
        
        .cdt-btn.active:hover {
          background: #66bb6a;
        }
        
        .cdt-sync-indicator {
          margin-left: -6px;
          padding: 2px 6px;
          background: #2d4a2d;
          border-radius: 4px;
        }
        
        .cdt-btn.danger {
          border-color: #e57373;
        }
        
        .cdt-btn.danger:hover {
          background: #e57373;
          color: white;
        }
        
        .cdt-btn-close {
          background: none;
          border: none;
          color: #888;
          font-size: 18px;
          cursor: pointer;
          padding: 4px 8px;
        }
        
        .cdt-btn-close:hover {
          color: #fff;
        }
        
        .cdt-tabs {
          display: flex;
          background: #2d2d2d;
          border-bottom: 1px solid #444;
        }
        
        .cdt-tab {
          padding: 8px 16px;
          background: none;
          border: none;
          color: #888;
          font-size: 12px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
        }
        
        .cdt-tab:hover {
          color: #e0e0e0;
          background: #3c3c3c;
        }
        
        .cdt-tab.active {
          color: #4fc3f7;
          border-bottom-color: #4fc3f7;
        }
        
        .cdt-content {
          flex: 1;
          overflow: auto;
          padding: 12px;
        }
        
        .cdt-panel {
          display: none;
          height: 100%;
        }
        
        .cdt-panel.active {
          display: block;
        }
        
        .cdt-summary {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
        }
        
        .cdt-summary-card {
          flex: 1;
          background: #2d2d2d;
          border-radius: 8px;
          padding: 10px;
          text-align: center;
        }
        
        .cdt-summary-value {
          font-size: 20px;
          font-weight: 700;
          color: #4fc3f7;
        }
        
        .cdt-summary-value.errors { color: #e57373; }
        .cdt-summary-value.success { color: #81c784; }
        
        .cdt-summary-label {
          font-size: 10px;
          color: #888;
          margin-top: 2px;
        }
        
        .cdt-log-entry {
          display: flex;
          gap: 8px;
          padding: 6px 8px;
          background: #2d2d2d;
          border-radius: 4px;
          margin-bottom: 4px;
          border-left: 3px solid #666;
          align-items: flex-start;
        }
        
        .cdt-log-entry.log { border-left-color: #888; }
        .cdt-log-entry.info { border-left-color: #4fc3f7; }
        .cdt-log-entry.warn { border-left-color: #ffb74d; }
        .cdt-log-entry.error { border-left-color: #e57373; }
        .cdt-log-entry.debug { border-left-color: #ce93d8; }
        
        .cdt-log-type {
          min-width: 45px;
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 600;
          color: #888;
        }
        
        .cdt-log-entry.error .cdt-log-type { color: #e57373; }
        .cdt-log-entry.warn .cdt-log-type { color: #ffb74d; }
        .cdt-log-entry.info .cdt-log-type { color: #4fc3f7; }
        
        .cdt-log-message {
          flex: 1;
          word-break: break-word;
          font-family: 'Menlo', 'Monaco', monospace;
          font-size: 11px;
          white-space: pre-wrap;
        }
        
        .cdt-log-time {
          color: #666;
          font-size: 10px;
          white-space: nowrap;
        }
        
        .cdt-network-entry {
          display: flex;
          gap: 10px;
          padding: 6px 8px;
          background: #2d2d2d;
          border-radius: 4px;
          margin-bottom: 4px;
          align-items: center;
          font-size: 11px;
        }
        
        .cdt-network-method {
          min-width: 50px;
          font-weight: 600;
          color: #81c784;
        }
        
        .cdt-network-status {
          min-width: 40px;
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: 600;
          text-align: center;
        }
        
        .cdt-network-status.success { background: #81c784; color: #1e1e1e; }
        .cdt-network-status.redirect { background: #4fc3f7; color: #1e1e1e; }
        .cdt-network-status.client-error { background: #ffb74d; color: #1e1e1e; }
        .cdt-network-status.server-error { background: #e57373; color: #fff; }
        .cdt-network-status.pending { background: #666; color: #fff; }
        
        .cdt-network-url {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-family: 'Menlo', 'Monaco', monospace;
          color: #888;
        }
        
        .cdt-network-duration {
          min-width: 60px;
          text-align: right;
          color: #888;
        }
        
        .cdt-empty {
          text-align: center;
          padding: 40px;
          color: #666;
        }
        
        .cdt-element-form {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .cdt-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #444;
          border-radius: 6px;
          background: #2d2d2d;
          color: #e0e0e0;
          font-family: 'Menlo', 'Monaco', monospace;
          font-size: 12px;
        }
        
        .cdt-element-result {
          background: #2d2d2d;
          border-radius: 8px;
          padding: 12px;
          font-family: 'Menlo', 'Monaco', monospace;
          font-size: 11px;
          white-space: pre-wrap;
          overflow: auto;
          max-height: 250px;
        }
        
        .cdt-storage-section {
          margin-bottom: 16px;
        }
        
        .cdt-storage-title {
          font-size: 12px;
          font-weight: 600;
          color: #4fc3f7;
          margin-bottom: 8px;
        }
        
        .cdt-storage-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        
        .cdt-storage-table th,
        .cdt-storage-table td {
          padding: 6px 8px;
          text-align: left;
          border-bottom: 1px solid #3c3c3c;
        }
        
        .cdt-storage-table th {
          background: #2d2d2d;
          font-weight: 600;
        }
        
        .cdt-storage-key {
          font-family: 'Menlo', 'Monaco', monospace;
          color: #81c784;
        }
        
        .cdt-storage-value {
          font-family: 'Menlo', 'Monaco', monospace;
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .cdt-footer {
          padding: 8px 14px;
          background: #2d2d2d;
          border-top: 1px solid #444;
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        
        /* Resize handle */
        .cdt-resize-handle {
          position: absolute;
          top: 0;
          left: 0;
          width: 16px;
          height: 16px;
          cursor: nw-resize;
        }
      </style>
      
      <div class="cdt-resize-handle" id="cdt-resize"></div>
      <div class="cdt-backgrounded-indicator">BG</div>
      
      <!-- Minimized view (shown when collapsed) -->
      <div class="cdt-minimized-view" id="cdt-minimized-view" title="Click to expand">
        <span class="cdt-mini-icon">🔍</span>
        <div class="cdt-mini-status">
          <div class="cdt-mini-dot" id="cdt-mini-dot"></div>
          <span id="cdt-mini-status-text">Idle</span>
        </div>
        <div class="cdt-mini-counts">
          <span id="cdt-mini-logs">0</span> logs
          <span class="errors">(<span id="cdt-mini-errors">0</span> err)</span>
        </div>
      </div>
      
      <div class="cdt-header">
        <span class="cdt-title">🔍 Comet AI DevTools</span>
        <div class="cdt-status">
          <div class="cdt-status-dot" id="cdt-status-dot"></div>
          <span id="cdt-status-text">Idle</span>
        </div>
        <button class="cdt-btn" id="cdt-btn-sync" title="Sync data across tabs">🔗 Sync Tabs</button>
        <span class="cdt-sync-indicator" id="cdt-sync-status" style="display:none; font-size:10px; color:#81c784;"></span>
        <button class="cdt-btn primary" id="cdt-btn-toggle">Start</button>
        <button class="cdt-btn" id="cdt-btn-minimize" title="Minimize to floating button">−</button>
        <button class="cdt-btn-close" id="cdt-btn-close">✕</button>
      </div>
      
      <div class="cdt-tabs">
        <button class="cdt-tab active" data-panel="console">Console</button>
        <button class="cdt-tab" data-panel="network">Network</button>
        <button class="cdt-tab" data-panel="elements">Elements</button>
        <button class="cdt-tab" data-panel="storage">Storage</button>
      </div>
      
      <div class="cdt-content">
        <!-- Console Panel -->
        <div class="cdt-panel active" id="cdt-panel-console">
          <div class="cdt-summary">
            <div class="cdt-summary-card">
              <div class="cdt-summary-value" id="cdt-console-total">0</div>
              <div class="cdt-summary-label">Total</div>
            </div>
            <div class="cdt-summary-card">
              <div class="cdt-summary-value errors" id="cdt-console-errors">0</div>
              <div class="cdt-summary-label">Errors</div>
            </div>
            <div class="cdt-summary-card">
              <div class="cdt-summary-value" style="color: #ffb74d" id="cdt-console-warnings">0</div>
              <div class="cdt-summary-label">Warnings</div>
            </div>
          </div>
          <div id="cdt-console-list">
            <div class="cdt-empty">Click "Start" to begin capturing console logs</div>
          </div>
        </div>
        
        <!-- Network Panel -->
        <div class="cdt-panel" id="cdt-panel-network">
          <div class="cdt-summary">
            <div class="cdt-summary-card">
              <div class="cdt-summary-value" id="cdt-network-total">0</div>
              <div class="cdt-summary-label">Requests</div>
            </div>
            <div class="cdt-summary-card">
              <div class="cdt-summary-value errors" id="cdt-network-failed">0</div>
              <div class="cdt-summary-label">Failed</div>
            </div>
            <div class="cdt-summary-card">
              <div class="cdt-summary-value success" id="cdt-network-success">0</div>
              <div class="cdt-summary-label">Success</div>
            </div>
          </div>
          <div id="cdt-network-list">
            <div class="cdt-empty">Click "Start" to begin capturing network requests</div>
          </div>
        </div>
        
        <!-- Elements Panel -->
        <div class="cdt-panel" id="cdt-panel-elements">
          <div class="cdt-element-form">
            <input type="text" class="cdt-input" id="cdt-selector-input" placeholder="Enter CSS selector (e.g., #header, .nav-item)">
            <button class="cdt-btn" id="cdt-btn-inspect">Inspect</button>
          </div>
          <div class="cdt-element-result" id="cdt-element-result">
            Enter a CSS selector above to inspect an element on this page.
          </div>
        </div>
        
        <!-- Storage Panel -->
        <div class="cdt-panel" id="cdt-panel-storage">
          <div class="cdt-storage-section">
            <div class="cdt-storage-title">Local Storage (<span id="cdt-ls-count">0</span> items)</div>
            <table class="cdt-storage-table">
              <thead><tr><th>Key</th><th>Value</th></tr></thead>
              <tbody id="cdt-ls-body"></tbody>
            </table>
          </div>
          <div class="cdt-storage-section">
            <div class="cdt-storage-title">Session Storage (<span id="cdt-ss-count">0</span> items)</div>
            <table class="cdt-storage-table">
              <thead><tr><th>Key</th><th>Value</th></tr></thead>
              <tbody id="cdt-ss-body"></tbody>
            </table>
          </div>
          <button class="cdt-btn" id="cdt-btn-refresh-storage" style="margin-top: 12px;">Refresh Storage</button>
        </div>
      </div>
      
      <div class="cdt-footer">
        <button class="cdt-btn" id="cdt-btn-export">📥 Export JSON</button>
        <button class="cdt-btn danger" id="cdt-btn-clear">🗑 Clear</button>
        <button class="cdt-btn danger" id="cdt-btn-hard-reset" title="Clear all data and reset sync (persists across refreshes)">⚠️ Hard Reset</button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Attach event listeners
    attachEventListeners();
    
    return overlay;
  }

  // ============================================
  // Event Listeners
  // ============================================

  function attachEventListeners() {
    const overlay = document.getElementById('comet-devtools-overlay');
    
    // Close button
    document.getElementById('cdt-btn-close').addEventListener('click', () => {
      hideOverlay();
    });
    
    // Minimize button
    document.getElementById('cdt-btn-minimize').addEventListener('click', () => {
      minimizeOverlay();
    });
    
    // Expand from minimized view
    document.getElementById('cdt-minimized-view').addEventListener('click', () => {
      expandOverlay();
    });
    
    // Toggle monitoring
    document.getElementById('cdt-btn-toggle').addEventListener('click', () => {
      toggleMonitoring();
    });
    
    // Sync button
    document.getElementById('cdt-btn-sync').addEventListener('click', () => {
      if (state.syncEnabled) {
        disableSync();
      } else {
        // Prompt for group name or use default
        const groupId = prompt('Enter sync group name (leave empty for auto):', '');
        enableSync(groupId || null);
      }
    });
    
    // Tab switching
    document.querySelectorAll('.cdt-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const panelId = tab.getAttribute('data-panel');
        switchTab(panelId);
      });
    });
    
    // Element inspection
    document.getElementById('cdt-btn-inspect').addEventListener('click', () => {
      inspectElement();
    });
    
    document.getElementById('cdt-selector-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') inspectElement();
    });
    
    // Storage refresh
    document.getElementById('cdt-btn-refresh-storage').addEventListener('click', () => {
      refreshStorage();
    });
    
    // Export
    document.getElementById('cdt-btn-export').addEventListener('click', () => {
      exportData();
    });
    
    // Clear (soft - just this tab's view, not synced data)
    document.getElementById('cdt-btn-clear').addEventListener('click', () => {
      clearData();
    });
    
    // Hard Reset - clears everything across all synced tabs
    document.getElementById('cdt-btn-hard-reset').addEventListener('click', () => {
      if (confirm('This will clear ALL data across ALL synced tabs and cannot be undone. Continue?')) {
        hardReset();
      }
    });
    
    // Drag to resize (simplified)
    let isDragging = false;
    let startX, startY, startWidth, startHeight;
    
    document.getElementById('cdt-resize').addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = overlay.offsetWidth;
      startHeight = overlay.offsetHeight;
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = startX - e.clientX;
      const dy = startY - e.clientY;
      overlay.style.width = Math.max(400, startWidth + dx) + 'px';
      overlay.style.height = Math.max(300, startHeight + dy) + 'px';
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  // ============================================
  // UI Updates
  // ============================================

  function showOverlay(broadcast = false) {
    const overlay = document.getElementById('comet-devtools-overlay');
    if (overlay) {
      overlay.classList.add('visible');
      overlay.classList.remove('minimized');
      state.isVisible = true;
      state.isMinimized = false;
      refreshStorage(); // Load storage when shown
      saveState();
      
      if (broadcast && state.syncEnabled) {
        broadcastSync('SHOW_OVERLAY');
      }
    }
  }

  function hideOverlay(broadcast = false) {
    const overlay = document.getElementById('comet-devtools-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      overlay.classList.remove('minimized');
      state.isVisible = false;
      state.isMinimized = false;
      saveState();
      
      if (broadcast && state.syncEnabled) {
        broadcastSync('HIDE_OVERLAY');
      }
    }
  }

  function toggleOverlay(broadcast = false) {
    if (state.isVisible) {
      hideOverlay(broadcast);
    } else {
      showOverlay(broadcast);
    }
  }
  
  function minimizeOverlay() {
    const overlay = document.getElementById('comet-devtools-overlay');
    if (overlay) {
      overlay.classList.add('minimized');
      state.isMinimized = true;
      updateMinimizedView();
      saveState();
    }
  }
  
  function expandOverlay() {
    const overlay = document.getElementById('comet-devtools-overlay');
    if (overlay) {
      overlay.classList.remove('minimized');
      state.isMinimized = false;
      saveState();
    }
  }
  
  function updateMinimizedView() {
    const dot = document.getElementById('cdt-mini-dot');
    const statusText = document.getElementById('cdt-mini-status-text');
    const logsCount = document.getElementById('cdt-mini-logs');
    const errorsCount = document.getElementById('cdt-mini-errors');
    
    if (dot && statusText) {
      dot.classList.toggle('active', state.isMonitoring);
      dot.classList.toggle('synced', state.syncEnabled);
      
      if (state.isMonitoring) {
        statusText.textContent = state.syncEnabled ? 'Rec+Sync' : 'Recording';
      } else {
        statusText.textContent = state.syncEnabled ? 'Synced' : 'Idle';
      }
    }
    
    if (logsCount) {
      logsCount.textContent = state.consoleLogs.length;
    }
    
    if (errorsCount) {
      errorsCount.textContent = state.consoleLogs.filter(l => l.type === 'error').length;
    }
  }

  function toggleMonitoring() {
    state.isMonitoring = !state.isMonitoring;
    
    // Broadcast to synced tabs
    if (state.isMonitoring) {
      broadcastSync('MONITORING_START');
    } else {
      broadcastSync('MONITORING_STOP');
    }
    
    updateMonitoringUI();
    saveState();
  }
  
  function updateMonitoringUI() {
    const dot = document.getElementById('cdt-status-dot');
    const text = document.getElementById('cdt-status-text');
    const btn = document.getElementById('cdt-btn-toggle');
    
    if (dot && text && btn) {
      if (state.isMonitoring) {
        dot.classList.add('active');
        text.textContent = 'Recording';
        btn.textContent = 'Stop';
        btn.classList.remove('primary');
      } else {
        dot.classList.remove('active');
        text.textContent = 'Idle';
        btn.textContent = 'Start';
        btn.classList.add('primary');
      }
    }
  }

  function switchTab(panelId) {
    document.querySelectorAll('.cdt-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.cdt-panel').forEach(p => p.classList.remove('active'));
    
    document.querySelector(`.cdt-tab[data-panel="${panelId}"]`).classList.add('active');
    document.getElementById(`cdt-panel-${panelId}`).classList.add('active');
    
    state.activeTab = panelId;
    
    if (panelId === 'storage') {
      refreshStorage();
    }
  }

  function updateConsoleDisplay() {
    const list = document.getElementById('cdt-console-list');
    const total = document.getElementById('cdt-console-total');
    const errors = document.getElementById('cdt-console-errors');
    const warnings = document.getElementById('cdt-console-warnings');
    
    const errorCount = state.consoleLogs.filter(l => l.type === 'error').length;
    const warnCount = state.consoleLogs.filter(l => l.type === 'warn').length;
    
    if (total) total.textContent = state.consoleLogs.length;
    if (errors) errors.textContent = errorCount;
    if (warnings) warnings.textContent = warnCount;
    
    // Also update minimized view
    updateMinimizedView();
    
    if (!list) return;
    
    if (state.consoleLogs.length === 0) {
      list.innerHTML = '<div class="cdt-empty">No console logs captured yet</div>';
      return;
    }
    
    const recentLogs = state.consoleLogs.slice(-50).reverse();
    list.innerHTML = recentLogs.map(log => `
      <div class="cdt-log-entry ${log.type}">
        <span class="cdt-log-type">${log.type}</span>
        <span class="cdt-log-message">${escapeHtml(log.message)}${log.tabId && log.tabId !== state.tabId ? ' <span style="color:#4fc3f7;font-size:9px;">[Tab:' + log.tabId.substring(0,6) + ']</span>' : ''}</span>
        <span class="cdt-log-time">${formatTime(log.timestamp)}</span>
      </div>
    `).join('');
  }

  function updateNetworkDisplay() {
    const list = document.getElementById('cdt-network-list');
    const total = document.getElementById('cdt-network-total');
    const failed = document.getElementById('cdt-network-failed');
    const success = document.getElementById('cdt-network-success');
    
    const failedCount = state.networkRequests.filter(r => r.status >= 400 || r.status === 0).length;
    const successCount = state.networkRequests.filter(r => r.status >= 200 && r.status < 400).length;
    
    total.textContent = state.networkRequests.length;
    failed.textContent = failedCount;
    success.textContent = successCount;
    
    if (state.networkRequests.length === 0) {
      list.innerHTML = '<div class="cdt-empty">No network requests captured yet</div>';
      return;
    }
    
    const recentRequests = state.networkRequests.slice(-30).reverse();
    list.innerHTML = recentRequests.map(req => `
      <div class="cdt-network-entry">
        <span class="cdt-network-method">${req.method}</span>
        <span class="cdt-network-status ${getStatusClass(req.status)}">${req.status || '...'}</span>
        <span class="cdt-network-url" title="${escapeHtml(req.url)}">${truncateUrl(req.url)}</span>
        <span class="cdt-network-duration">${req.duration ? req.duration + 'ms' : '...'}</span>
      </div>
    `).join('');
  }

  function inspectElement() {
    const selector = document.getElementById('cdt-selector-input').value.trim();
    const result = document.getElementById('cdt-element-result');
    
    if (!selector) {
      result.textContent = 'Please enter a CSS selector';
      return;
    }
    
    try {
      const element = document.querySelector(selector);
      
      if (!element) {
        result.textContent = `No element found for selector: ${selector}`;
        return;
      }
      
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      
      const info = {
        tag: element.tagName.toLowerCase(),
        id: element.id || null,
        classes: Array.from(element.classList),
        attributes: {},
        dimensions: {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
        },
        styles: {
          display: styles.display,
          position: styles.position,
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          fontSize: styles.fontSize,
          padding: styles.padding,
          margin: styles.margin,
        },
        textContent: element.textContent?.substring(0, 100) || '',
        childCount: element.children.length,
      };
      
      // Get attributes
      for (const attr of element.attributes) {
        info.attributes[attr.name] = attr.value;
      }
      
      result.textContent = JSON.stringify(info, null, 2);
      
      // Briefly highlight the element
      const originalOutline = element.style.outline;
      element.style.outline = '3px solid #4fc3f7';
      setTimeout(() => {
        element.style.outline = originalOutline;
      }, 2000);
      
    } catch (error) {
      result.textContent = `Error: ${error.message}`;
    }
  }

  function refreshStorage() {
    // Local Storage
    const lsBody = document.getElementById('cdt-ls-body');
    const lsCount = document.getElementById('cdt-ls-count');
    const lsItems = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      lsItems.push({ key, value: localStorage.getItem(key) });
    }
    
    lsCount.textContent = lsItems.length;
    lsBody.innerHTML = lsItems.length === 0 
      ? '<tr><td colspan="2" class="cdt-empty">No items</td></tr>'
      : lsItems.map(item => `
          <tr>
            <td class="cdt-storage-key">${escapeHtml(item.key)}</td>
            <td class="cdt-storage-value" title="${escapeHtml(item.value)}">${escapeHtml(item.value)}</td>
          </tr>
        `).join('');
    
    // Session Storage
    const ssBody = document.getElementById('cdt-ss-body');
    const ssCount = document.getElementById('cdt-ss-count');
    const ssItems = [];
    
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      ssItems.push({ key, value: sessionStorage.getItem(key) });
    }
    
    ssCount.textContent = ssItems.length;
    ssBody.innerHTML = ssItems.length === 0
      ? '<tr><td colspan="2" class="cdt-empty">No items</td></tr>'
      : ssItems.map(item => `
          <tr>
            <td class="cdt-storage-key">${escapeHtml(item.key)}</td>
            <td class="cdt-storage-value" title="${escapeHtml(item.value)}">${escapeHtml(item.value)}</td>
          </tr>
        `).join('');
  }

  function exportData() {
    const data = {
      exportedAt: new Date().toISOString(),
      url: window.location.href,
      consoleLogs: state.consoleLogs,
      networkRequests: state.networkRequests,
      localStorage: {},
      sessionStorage: {},
    };
    
    // Include storage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      data.localStorage[key] = localStorage.getItem(key);
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      data.sessionStorage[key] = sessionStorage.getItem(key);
    }
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `devtools-export-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  function clearData() {
    state.consoleLogs = [];
    state.networkRequests = [];
    
    // Broadcast to synced tabs
    broadcastSync('CLEAR_LOGS');
    
    updateConsoleDisplay();
    updateNetworkDisplay();
    saveState();
  }

  // ============================================
  // Utility Functions
  // ============================================

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function getStatusClass(status) {
    if (status === 0) return 'pending';
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'redirect';
    if (status >= 400 && status < 500) return 'client-error';
    if (status >= 500) return 'server-error';
    return 'pending';
  }

  function truncateUrl(url, maxLength = 50) {
    if (url.length <= maxLength) return url;
    try {
      const parsed = new URL(url);
      const path = parsed.pathname + parsed.search;
      if (path.length > maxLength - 3) {
        return '...' + path.substring(path.length - maxLength + 3);
      }
      return path;
    } catch {
      return url.substring(0, maxLength - 3) + '...';
    }
  }

  // ============================================
  // Global API for Comet Assistant
  // ============================================

  window.CometDevTools = {
    // Help / Discovery (for AI assistants to learn about this tool)
    help: () => ({
      name: 'Comet AI DevTools Bridge',
      version: '1.3.0',
      description: 'DevTools overlay for debugging web pages with cross-tab sync and MCP tools',
      quickStart: [
        'CometDevTools.show() - Show the overlay',
        'CometDevTools.startMonitoring() - Start capturing console/network',
        'CometDevTools.getSummary() - Get current status',
        'CometDevTools.getConsoleLogs({ type: "error" }) - Get errors',
        'CometDevTools.MCP.listTools() - See all MCP tools',
      ],
      whenToUse: [
        'User asks to debug a webpage',
        'User wants to find console errors',
        'User is testing a multi-page flow',
        'User asks "why isn\'t this working?"',
        'User wants to monitor network requests',
        'User needs to automate form filling or clicks',
      ],
      typicalWorkflow: '1. show() → 2. startMonitoring() → 3. [user interacts] → 4. getSummary() → 5. getConsoleLogs({type:"error"})',
    }),
    
    // Detailed instructions for AI
    getInstructions: () => `
COMET AI DEVTOOLS - USAGE GUIDE

This extension lets you monitor and debug web pages. It captures console logs, 
network requests, and lets you inspect elements.

STEP 1 - SHOW AND START:
  CometDevTools.show()
  CometDevTools.startMonitoring()

STEP 2 - MONITOR:
  - Let the user interact with the page, OR
  - Use MCP tools to automate: CometDevTools.MCP.callTool('click_element', {selector: 'button'})

STEP 3 - ANALYZE:
  CometDevTools.getSummary()  // Quick overview
  CometDevTools.getConsoleLogs({ type: 'error' })  // Get errors
  CometDevTools.getNetworkRequests({ failed: true })  // Get failed requests

STEP 4 - REPORT:
  Summarize findings to the user

COMMON COMMANDS:
  getConsoleLogs()                    - All console output
  getConsoleLogs({type:'error'})      - Only errors  
  getConsoleLogs({type:'warn'})       - Only warnings
  getNetworkRequests()                - All network calls
  getNetworkRequests({failed:true})   - Only failures
  getNetworkRequests({method:'POST'}) - Only POST requests
  inspectElement('#selector')         - Get element info
  enableSync('group-name')            - Sync across tabs

MCP TOOLS (for structured calls):
  CometDevTools.MCP.callTool('start_monitoring')
  CometDevTools.MCP.callTool('get_console_logs', {type: 'error', limit: 10})
  CometDevTools.MCP.callTool('click_element', {selector: 'button.submit'})
  CometDevTools.MCP.callTool('type_text', {selector: '#email', text: 'test@test.com'})
  CometDevTools.MCP.callTool('execute_script', {script: 'document.title'})
  CometDevTools.MCP.callTool('get_page_info')

MINIMIZE MODE:
  CometDevTools.minimize()  - Collapse to tiny indicator
  CometDevTools.expand()    - Restore full view

CROSS-TAB SYNC (for multi-page flows):
  CometDevTools.enableSync('checkout-test')  - Link tabs
  Data from all synced tabs appears in each overlay
`,
    
    // Show/hide the overlay
    show: (broadcast = false) => showOverlay(broadcast),
    hide: (broadcast = false) => hideOverlay(broadcast),
    toggle: (broadcast = false) => toggleOverlay(broadcast),
    minimize: () => minimizeOverlay(),
    expand: () => expandOverlay(),
    isMinimized: () => state.isMinimized,
    
    // Monitoring controls
    startMonitoring: () => {
      if (!state.isMonitoring) toggleMonitoring();
    },
    stopMonitoring: () => {
      if (state.isMonitoring) toggleMonitoring();
    },
    isMonitoring: () => state.isMonitoring,
    
    // Sync controls
    enableSync: (groupId = null) => enableSync(groupId),
    disableSync: () => disableSync(),
    isSyncEnabled: () => state.syncEnabled,
    getSyncGroup: () => state.syncGroupId,
    
    // Get data (includes data from all synced tabs)
    getConsoleLogs: (filters = {}) => {
      let logs = [...state.consoleLogs];
      if (filters.type) {
        logs = logs.filter(l => l.type === filters.type);
      }
      if (filters.pattern) {
        const regex = new RegExp(filters.pattern, 'i');
        logs = logs.filter(l => regex.test(l.message));
      }
      if (filters.limit) {
        logs = logs.slice(-filters.limit);
      }
      return logs;
    },
    getNetworkRequests: (filters = {}) => {
      let requests = [...state.networkRequests];
      if (filters.method) {
        requests = requests.filter(r => r.method === filters.method);
      }
      if (filters.status) {
        requests = requests.filter(r => r.status === filters.status);
      }
      if (filters.urlPattern) {
        const regex = new RegExp(filters.urlPattern, 'i');
        requests = requests.filter(r => regex.test(r.url));
      }
      if (filters.failed) {
        requests = requests.filter(r => r.status >= 400 || r.status === 0);
      }
      if (filters.limit) {
        requests = requests.slice(-filters.limit);
      }
      return requests;
    },
    getStorage: () => {
      const ls = {};
      const ss = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        ls[key] = localStorage.getItem(key);
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        ss[key] = sessionStorage.getItem(key);
      }
      return { localStorage: ls, sessionStorage: ss };
    },
    
    // Element inspection
    inspectElement: (selector) => {
      try {
        const element = document.querySelector(selector);
        if (!element) return { error: `Element not found: ${selector}` };
        
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || null,
          classes: Array.from(element.classList),
          attributes: Object.fromEntries(
            Array.from(element.attributes).map(a => [a.name, a.value])
          ),
          dimensions: { width: rect.width, height: rect.height, x: rect.x, y: rect.y },
          text: element.textContent?.substring(0, 200),
          innerHTML: element.innerHTML?.substring(0, 500),
          childCount: element.children.length,
          styles: {
            display: styles.display,
            position: styles.position,
            color: styles.color,
            backgroundColor: styles.backgroundColor,
            fontSize: styles.fontSize,
            padding: styles.padding,
            margin: styles.margin,
          },
        };
      } catch (error) {
        return { error: error.message };
      }
    },
    
    // Export
    exportData: exportData,
    
    // Clear
    clearLogs: clearData,
    
    // Hard reset (clears across all synced tabs)
    hardReset: hardReset,
    
    // Get summary
    getSummary: () => ({
      isMonitoring: state.isMonitoring,
      isMinimized: state.isMinimized,
      isBackgrounded: state.isBackgrounded,
      consoleLogs: state.consoleLogs.length,
      consoleErrors: state.consoleLogs.filter(l => l.type === 'error').length,
      consoleWarnings: state.consoleLogs.filter(l => l.type === 'warn').length,
      networkRequests: state.networkRequests.length,
      networkFailed: state.networkRequests.filter(r => r.status >= 400 || r.status === 0).length,
      syncEnabled: state.syncEnabled,
      syncGroup: state.syncGroupId,
      tabId: state.tabId,
      url: window.location.href,
    }),
    
    // Get tab ID for debugging
    getTabId: () => state.tabId,
    
    // Check if tab is backgrounded
    isBackgrounded: () => state.isBackgrounded,
  };
  
  // ============================================
  // MCP Tools Interface
  // ============================================
  
  window.CometDevTools.MCP = {
    // List available tools (MCP discovery)
    listTools: () => ([
      {
        name: 'inspect_element',
        description: 'Get detailed information about a DOM element by CSS selector',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector for the element' },
          },
          required: ['selector'],
        },
      },
      {
        name: 'get_console_logs',
        description: 'Retrieve console log entries with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['log', 'info', 'warn', 'error', 'debug'], description: 'Filter by log type' },
            pattern: { type: 'string', description: 'Regex pattern to filter messages' },
            limit: { type: 'number', description: 'Max number of logs to return' },
          },
        },
      },
      {
        name: 'get_network_requests',
        description: 'Retrieve network request logs with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            method: { type: 'string', description: 'Filter by HTTP method (GET, POST, etc.)' },
            status: { type: 'number', description: 'Filter by status code' },
            urlPattern: { type: 'string', description: 'Regex pattern to filter URLs' },
            failed: { type: 'boolean', description: 'Only return failed requests (4xx/5xx)' },
            limit: { type: 'number', description: 'Max number of requests to return' },
          },
        },
      },
      {
        name: 'get_storage',
        description: 'Get localStorage and sessionStorage data',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'start_monitoring',
        description: 'Start capturing console logs and network requests',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'stop_monitoring',
        description: 'Stop capturing data',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'enable_sync',
        description: 'Enable cross-tab synchronization',
        inputSchema: {
          type: 'object',
          properties: {
            groupId: { type: 'string', description: 'Sync group name (optional)' },
          },
        },
      },
      {
        name: 'disable_sync',
        description: 'Disable cross-tab synchronization',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_summary',
        description: 'Get a summary of current DevTools state',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'export_data',
        description: 'Export all captured data as JSON file',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'clear_logs',
        description: 'Clear all captured logs (syncs to other tabs if sync enabled)',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'hard_reset',
        description: 'Clear all data across all synced tabs and reset state',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'show_overlay',
        description: 'Show the DevTools overlay UI',
        inputSchema: {
          type: 'object',
          properties: {
            minimized: { type: 'boolean', description: 'Show in minimized mode' },
          },
        },
      },
      {
        name: 'hide_overlay',
        description: 'Hide the DevTools overlay UI',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'execute_script',
        description: 'Execute JavaScript in the page context and return result',
        inputSchema: {
          type: 'object',
          properties: {
            script: { type: 'string', description: 'JavaScript code to execute' },
          },
          required: ['script'],
        },
      },
      {
        name: 'click_element',
        description: 'Click an element by CSS selector',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector for the element to click' },
          },
          required: ['selector'],
        },
      },
      {
        name: 'type_text',
        description: 'Type text into an input element',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector for the input element' },
            text: { type: 'string', description: 'Text to type' },
          },
          required: ['selector', 'text'],
        },
      },
      {
        name: 'get_page_info',
        description: 'Get information about the current page',
        inputSchema: { type: 'object', properties: {} },
      },
    ]),
    
    // Call a tool by name (MCP invocation)
    callTool: (toolName, args = {}) => {
      const tools = {
        inspect_element: () => window.CometDevTools.inspectElement(args.selector),
        get_console_logs: () => window.CometDevTools.getConsoleLogs(args),
        get_network_requests: () => window.CometDevTools.getNetworkRequests(args),
        get_storage: () => window.CometDevTools.getStorage(),
        start_monitoring: () => { window.CometDevTools.startMonitoring(); return { success: true, message: 'Monitoring started' }; },
        stop_monitoring: () => { window.CometDevTools.stopMonitoring(); return { success: true, message: 'Monitoring stopped' }; },
        enable_sync: () => { window.CometDevTools.enableSync(args.groupId); return { success: true, groupId: state.syncGroupId }; },
        disable_sync: () => { window.CometDevTools.disableSync(); return { success: true }; },
        get_summary: () => window.CometDevTools.getSummary(),
        export_data: () => { window.CometDevTools.exportData(); return { success: true, message: 'Export triggered' }; },
        clear_logs: () => { window.CometDevTools.clearLogs(); return { success: true }; },
        hard_reset: () => { window.CometDevTools.hardReset(); return { success: true }; },
        show_overlay: () => {
          window.CometDevTools.show();
          if (args.minimized) window.CometDevTools.minimize();
          return { success: true };
        },
        hide_overlay: () => { window.CometDevTools.hide(); return { success: true }; },
        execute_script: () => {
          try {
            const result = eval(args.script);
            return { success: true, result };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        click_element: () => {
          try {
            const el = document.querySelector(args.selector);
            if (!el) return { success: false, error: 'Element not found' };
            el.click();
            return { success: true, message: `Clicked ${args.selector}` };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        type_text: () => {
          try {
            const el = document.querySelector(args.selector);
            if (!el) return { success: false, error: 'Element not found' };
            el.value = args.text;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, message: `Typed text into ${args.selector}` };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        get_page_info: () => ({
          url: window.location.href,
          title: document.title,
          readyState: document.readyState,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
          scroll: {
            x: window.scrollX,
            y: window.scrollY,
          },
          documentSize: {
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
          },
        }),
      };
      
      if (!tools[toolName]) {
        return { success: false, error: `Unknown tool: ${toolName}` };
      }
      
      try {
        return tools[toolName]();
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
  };

  // ============================================
  // Initialize
  // ============================================

  // Init sync channel first
  initSyncChannel();
  
  // Load persisted state (from previous page load)
  const stateLoaded = loadState();
  
  // Intercept console and network
  interceptConsole();
  interceptNetwork();
  
  // Create overlay UI
  createOverlay();
  
  // Restore UI state if loaded
  if (stateLoaded) {
    updateConsoleDisplay();
    updateNetworkDisplay();
    updateMonitoringUI();
    updateSyncUI();
    updateMinimizedView();
    
    if (state.isVisible) {
      if (state.isMinimized) {
        showOverlay();
        minimizeOverlay();
      } else {
        showOverlay();
      }
    }
    
    console.log('[Comet DevTools] State restored from previous session');
  }
  
  console.log('[Comet DevTools] Initialized. Use CometDevTools.show() or press Ctrl+Shift+D to open.');
  console.log('[Comet DevTools] MCP tools available via CometDevTools.MCP.listTools() and CometDevTools.MCP.callTool(name, args)');
  
  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      toggleOverlay();
    }
  });
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_OVERLAY') {
      toggleOverlay();
      sendResponse({ success: true, isVisible: state.isVisible });
    } else if (message.type === 'SHOW_OVERLAY') {
      showOverlay();
      sendResponse({ success: true });
    } else if (message.type === 'HIDE_OVERLAY') {
      hideOverlay();
      sendResponse({ success: true });
    } else if (message.type === 'GET_STATUS') {
      sendResponse({
        success: true,
        data: window.CometDevTools.getSummary()
      });
    } else if (message.type === 'MCP_CALL') {
      // Allow MCP calls from background script
      const result = window.CometDevTools.MCP.callTool(message.tool, message.args);
      sendResponse({ success: true, data: result });
    }
    return true;
  });
  
  // Save state before page unload
  window.addEventListener('beforeunload', () => {
    saveState();
  });
  
  // Track tab visibility (background/foreground)
  document.addEventListener('visibilitychange', () => {
    const wasBackgrounded = state.isBackgrounded;
    state.isBackgrounded = document.hidden;
    
    const overlay = document.getElementById('comet-devtools-overlay');
    if (overlay) {
      overlay.classList.toggle('backgrounded', state.isBackgrounded);
    }
    
    // Log visibility change if monitoring
    if (state.isMonitoring && wasBackgrounded !== state.isBackgrounded) {
      const entry = {
        id: state.tabId + '-visibility-' + Date.now(),
        type: 'info',
        message: state.isBackgrounded ? '[Tab moved to background]' : '[Tab returned to foreground]',
        timestamp: Date.now(),
        source: 'CometDevTools',
        tabId: state.tabId,
        url: window.location.href,
      };
      state.consoleLogs.push(entry);
      broadcastSync('CONSOLE_LOG', { log: entry });
      updateConsoleDisplay();
    }
  });
  
  // Initial background state check
  state.isBackgrounded = document.hidden;
}
