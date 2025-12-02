# Comet AI DevTools Bridge

A Chrome extension that provides DevTools monitoring and debugging capabilities for the Comet browser, with MCP protocol integration for AI assistants.

## Features

- **Cross-Tab Sync**: Link multiple tabs together to monitor data across complex multi-page workflows
- **Console Monitoring**: Capture and filter console logs (errors, warnings, info, debug)
- **Network Monitoring**: Track all network requests with detailed information
- **Element Inspection**: Inspect DOM elements and their properties
- **Minimize Mode**: Collapse to a tiny floating indicator for non-intrusive monitoring
- **Background Tab Operation**: Continues monitoring even when tab is not in focus
- **MCP Tools API**: Structured tool interface for AI assistants to interact with the browser
- **Persistence**: Data survives page refreshes (cleared on hard reset)
- **Export**: JSON/CSV export of captured data

## Installation

### Windows

1. Download the latest release from the [Releases](../../releases) page
2. Extract the zip file
3. Open Comet browser and navigate to `chrome://extensions/`
4. Enable **Developer mode** (toggle in top right)
5. Click **Load unpacked**
6. Select the extracted `dist` folder
7. Navigate to any website
8. Press **Ctrl+Shift+D** to open the overlay

### macOS

1. Download the latest release from the [Releases](../../releases) page
2. Extract the zip file
3. Open Comet browser and navigate to `chrome://extensions/`
4. Enable **Developer mode** (toggle in top right)
5. Click **Load unpacked**
6. Select the extracted `dist` folder
7. Navigate to any website
8. Press **Cmd+Shift+D** to open the overlay

## Usage

### Basic Usage

1. **Open the overlay**: Press `Ctrl+Shift+D` (Windows) or `Cmd+Shift+D` (Mac)
2. **Start monitoring**: Click the "Start" button
3. **View captured data**: Switch between tabs (Console, Network, Elements, Storage)
4. **Stop monitoring**: Click the "Stop" button
5. **Export data**: Click the "Export" button for JSON/CSV output

### Minimize Mode

Click the **−** button in the overlay header to collapse to a tiny floating indicator that shows:
- Recording status (dot indicator)
- Sync status
- Log count
- Error count

Click the indicator to expand back to full view.

### Cross-Tab Sync

1. Click the **🔗 Sync Tabs** button
2. Enter a group name (or leave empty for auto-generation)
3. Open the same overlay on other tabs
4. Join the same sync group
5. All console logs and network requests now sync in real-time across tabs
6. Each entry shows which tab/URL it came from

### JavaScript API

The extension exposes a global `CometDevTools` object that can be used programmatically:

```javascript
// Show/hide overlay
CometDevTools.show()              // Show overlay
CometDevTools.show(true)          // Show and enable sync
CometDevTools.minimize()          // Collapse to indicator
CometDevTools.hide()              // Hide completely

// Start/stop monitoring
CometDevTools.startMonitoring()
CometDevTools.stopMonitoring()

// Get debugging data
CometDevTools.getConsoleLogs()                    // All logs
CometDevTools.getConsoleLogs({ type: 'error' })  // Only errors
CometDevTools.getNetworkRequests()                // All requests
CometDevTools.getNetworkRequests({ failed: true }) // Failed requests
CometDevTools.getSummary()                        // Quick status

// Inspect elements
CometDevTools.inspectElement('#header')          // By selector
CometDevTools.inspectElement('.error-msg')

// Cross-tab sync
CometDevTools.enableSync('my-session')
CometDevTools.disableSync()
CometDevTools.isSyncEnabled()
CometDevTools.getSyncGroup()

// Reset
CometDevTools.hardReset()  // Clear all data across synced tabs
```

### MCP Tools Interface

For AI assistants (like Comet AI), the extension provides a structured MCP tools interface:

```javascript
// List available tools
CometDevTools.MCP.listTools()

// Call tools by name
CometDevTools.MCP.callTool('start_monitoring')
CometDevTools.MCP.callTool('get_console_logs', { type: 'error' })
CometDevTools.MCP.callTool('get_network_requests', { failed: true })
CometDevTools.MCP.callTool('inspect_element', { selector: '#header' })
CometDevTools.MCP.callTool('click_element', { selector: 'button.submit' })
CometDevTools.MCP.callTool('type_text', { selector: '#email', text: 'test@example.com' })
CometDevTools.MCP.callTool('execute_script', { script: 'document.title' })
CometDevTools.MCP.callTool('get_page_info')
```

**16 MCP tools available** including:
- `start_monitoring` / `stop_monitoring`
- `get_console_logs` / `get_network_requests` / `get_summary`
- `inspect_element` / `click_element` / `type_text`
- `execute_script` / `get_page_info`
- `enable_sync` / `disable_sync`
- `clear_data` / `hard_reset`
- `export_data`

### Teaching Comet AI About the Tool

To enable the Comet AI assistant to use this extension, you can:

1. **Add Custom Instructions**: Copy the content from `COMET_INSTRUCTIONS.md` (included in releases) to Comet browser's Settings → Assistant → Custom Instructions

2. **Let AI discover it**: The extension includes built-in help that AI can call:
   ```javascript
   CometDevTools.help()             // Quick reference
   CometDevTools.getInstructions()  // Detailed guide
   ```

3. **Tell Comet once**: In a conversation, tell the assistant:
   > "I have the CometDevTools extension installed. You can use `CometDevTools.help()` to learn how to use it."

## Development

### Prerequisites

- Node.js 16+ and npm
- Comet browser or any Chromium-based browser

### Setup

```bash
# Clone the repository
git clone https://github.com/Llompi/comet-ai-devtools.git
cd comet-ai-devtools

# Install dependencies
npm install

# Build the extension
npm run build

# Development mode (watch for changes)
npm run dev
```

### Project Structure

```
comet-ai-devtools/
├── dist/                  # Built extension (load this in browser)
├── src/
│   ├── background/       # Background service worker
│   ├── content/          # Content scripts (overlay UI)
│   ├── devtools/         # DevTools panel (optional)
│   ├── mcp/              # MCP protocol implementation
│   ├── types/            # TypeScript type definitions
│   ├── ui/               # Popup UI
│   └── utils/            # Helper functions
├── icons/                # Extension icons
├── manifest.json         # Extension manifest (Manifest V3)
├── package.json
└── README.md
```

### Build Commands

```bash
npm run build     # Build for production
npm run dev       # Watch mode for development
npm run clean     # Clean dist folder
```

## Version History

### v1.3.1 (Latest)
- Added minimize mode with floating indicator
- Added MCP tools API for AI assistants
- Background tab operation support
- Built-in help and instructions API

### v1.3
- Cross-tab synchronization
- Persistence across page refreshes
- Hard reset functionality
- Windows compatibility improvements

### v1.2
- Content script overlay approach (visible to AI)
- Fixed debugger attachment issues
- Improved accessibility

### v1.1
- Redesigned architecture
- Removed DevTools panel dependency

### v1.0
- Initial MVP release
- Console and network monitoring
- Basic element inspection

## Contributing

Contributions are welcome! This is an open-source project intended to be free for anyone to use and display.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Issues and Feature Requests

Please open issues for:
- Bug reports
- Feature requests
- Questions or discussions

Note: This project is maintained as time allows. No promises to add features personally, but community contributions are appreciated!

## License

MIT License - see [LICENSE](LICENSE) file for details.

This project is free to use, modify, and distribute. Anyone can use it and display it publicly.

## Acknowledgments

- Built with assistance from Claude (Anthropic)
- Designed for the Comet browser by Perplexity
- Inspired by Chrome DevTools and MCP protocol

## Support

For support:
- Open an [issue](../../issues)
- Check existing [discussions](../../discussions)
- Review the [COMET_INSTRUCTIONS.md](COMET_INSTRUCTIONS.md) file

## Roadmap

### Phase 2 (Planned)
- IndexedDB inspection
- Real-time filtering/search
- Performance budget alerts
- DOM mutation tracking
- Request body/response inspection

### Phase 3 (Future)
- WebSocket MCP server on localhost:12306
- Comet Assistant message bridge
- Natural language command parsing
- Automated debugging flows

---

**Built with ❤️ for developers using Comet browser**
