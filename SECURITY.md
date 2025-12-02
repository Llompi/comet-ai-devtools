# Security Policy

## Supported Versions

This extension is currently in active development. Security updates will be applied to the latest version.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest| :x:                |

## Reporting a Vulnerability

We take the security of Comet AI DevTools Bridge seriously. If you believe you've found a security vulnerability, please follow these steps:

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Instead, please open a new issue in the repository with the title "[SECURITY] - Brief Description"
3. Provide as much detail as possible:
   - Type of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Initial Response**: We will acknowledge receipt of your vulnerability report within 48 hours
- **Status Updates**: You'll receive updates on the progress at least every 7 days
- **Resolution**: We aim to resolve critical security issues within 30 days
- **Credit**: If you wish, we'll credit you for the responsible disclosure

### Scope

Security issues we're particularly interested in:

- Code injection vulnerabilities
- Cross-site scripting (XSS) in the DevTools panel
- Unauthorized access to browser data
- MCP protocol security issues
- Data exposure or privacy concerns
- Authentication/authorization bypasses

### Out of Scope

- Issues in third-party dependencies (report these to the respective projects)
- Social engineering attacks
- Physical attacks
- Issues requiring extensive user interaction

## Security Best Practices

When using this extension:

1. **Keep Updated**: Always use the latest version of the extension
2. **Review Permissions**: The extension only requires permissions necessary for DevTools functionality
3. **Data Privacy**: Extension data remains local; no data is sent to external servers
4. **MCP Security**: When connecting to AI assistants via MCP, ensure you trust the assistant service

## Security Updates

Security updates will be:

- Released as soon as possible after discovery
- Documented in the CHANGELOG.md with [SECURITY] tag
- Announced in the repository's README
- Highlighted in release notes

## Contact

For security-related questions that don't constitute vulnerabilities, please open a regular GitHub issue with the "security question" label.

## Acknowledgments

We appreciate the security research community's efforts in responsibly disclosing vulnerabilities. Contributors who report valid security issues will be credited (with their permission) in:

- The repository's security advisories
- Release notes for the fix
- This SECURITY.md file

Thank you for helping keep Comet AI DevTools Bridge secure!
