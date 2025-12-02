# Contributing to Comet AI DevTools Bridge

First off, thank you for considering contributing to Comet AI DevTools Bridge! It's people like you that make this extension better for everyone.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior by opening an issue.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- Use the bug report template
- Include your Comet browser version
- Include your operating system and version
- Describe the exact steps to reproduce the problem
- Provide specific examples to demonstrate the steps
- Describe the behavior you observed and what you expected
- Include screenshots if relevant

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- Use the feature request template
- Provide a clear description of the proposed feature
- Explain why this enhancement would be useful
- List any similar features in other tools if applicable

### Pull Requests

We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`
2. Make your changes
3. If you've added code, add tests if applicable
4. Ensure your code follows the existing style
5. Update documentation as needed
6. Write clear, descriptive commit messages
7. Open a pull request!

## Development Setup

### Prerequisites

- Comet browser installed
- Basic knowledge of Chrome extension development
- Familiarity with JavaScript and browser DevTools

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Llompi/comet-ai-devtools.git
   cd comet-ai-devtools
   ```

2. **Load the extension in Comet browser**
   - Navigate to `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked"
   - Select the `dist` folder from this repository

3. **Make your changes**
   - Edit files in the `dist` folder
   - The extension will reload automatically in some cases
   - For manifest changes, you'll need to reload manually

4. **Test your changes**
   - Open DevTools in any Comet browser tab
   - Navigate to the "Comet AI" panel
   - Verify functionality works as expected
   - Test across different scenarios and page types

## Coding Guidelines

### JavaScript Style

- Use ES6+ features where appropriate
- Follow consistent indentation (2 spaces)
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and concise

### Commit Messages

Follow these guidelines for commit messages:

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

Examples:
```
Add network request filtering feature

Fix tab sync when multiple windows are open (#42)

Update README with new installation instructions
```

### Extension Architecture

The extension consists of:

- **Background Service Worker** (`background.js`): Manages extension lifecycle and message passing
- **Content Script** (`content.js`): Injects the DevTools overlay into web pages
- **DevTools Panel** (`devtools.js`, `panel.html`, `panel.js`): The main UI for monitoring and interaction
- **MCP Bridge** (`mcp-bridge.js`): Handles communication with AI assistants via MCP protocol

### Testing

While we don't have automated tests yet, please manually test:

- Console log capture and filtering
- Network request monitoring
- Tab synchronization across multiple tabs
- Element inspection functionality
- MCP protocol communication
- Minimize mode functionality
- Data export features

## Documentation

When adding new features:

- Update the README.md with usage instructions
- Add inline code comments for complex logic
- Update COMET_INSTRUCTIONS.md if AI assistant integration changes
- Consider adding examples or screenshots

## Community

### Getting Help

- Check existing issues and discussions
- Review the README and COMET_INSTRUCTIONS documentation
- Open a new issue with the question label

### Code Review Process

The core team reviews pull requests regularly:

1. At least one approval is required before merging
2. Address any requested changes promptly
3. Keep the conversation focused and constructive
4. Be patient - reviews may take a few days

## Recognition

Contributors will be recognized in:

- The project README (Contributors section to be added)
- Release notes for significant contributions
- GitHub's automatic contributors tracking

## License

By contributing, you agree that your contributions will be licensed under the MIT License. This allows the extension to remain free and open-source for everyone.

## Questions?

Don't hesitate to open an issue if you have questions about contributing. We're here to help!

Thank you for contributing to Comet AI DevTools Bridge! 🚀
