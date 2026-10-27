# Local terminal MCP

Connect ChatGPT to the free local Desktop Commander MCP server on a Mac.
The setup uses a Cloudflare Quick Tunnel and does not use Desktop Commander's
metered remote service.

## Acceptance checks

- ChatGPT discovers the local server's terminal tools through the tunnel.
- A command invoked from ChatGPT returns a fresh value generated on the Mac.
- A process started by one tool call remains available to later calls.
- Starting, stopping, and restoring the service have documented commands.
- Runtime endpoints, local logs, and machine configuration remain outside Git.

## Runtime

Use the Node version in [.nvmrc](.nvmrc). Cloudflared is installed through
Homebrew. Installation, operation, review results, and end-to-end verification
will be documented with the implementation.

## Sources

- [Desktop Commander local server and pricing](https://desktopcommander.app/pricing/)
- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
- [ChatGPT custom MCP servers](https://developers.openai.com/api/docs/guides/custom-mcp-server)
