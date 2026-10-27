/** Serve one persistent local Desktop Commander process over JSON HTTP. */
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Server } from '@modelcontextprotocol/server';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { proxyServer, startHTTPServer } from 'mcp-proxy';

/** Start the upstream once; release HTTP and its child process on close. */
export async function startBridge({ port, endpointPath, onFailure = console.error }) {
  const upstream = new Client({ name: 'local-terminal-mcp', version: '0.1.0' });
  const command = fileURLToPath(new URL(
    '../node_modules/@wonderwhy-er/desktop-commander/dist/index.js', import.meta.url,
  ));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [command, '--no-onboarding'],
    cwd: homedir(),
    env: process.env,
    stderr: 'inherit',
  });
  let closing = false;
  let http;
  upstream.onclose = () => {
    if (!closing) onFailure(new Error('The local Desktop Commander process exited.'));
  };

  try {
    await upstream.connect(transport, { timeout: 60_000 });
    const capabilities = upstream.getServerCapabilities();
    http = await startHTTPServer({
      host: '127.0.0.1',
      port,
      streamEndpoint: endpointPath,
      sseEndpoint: null,
      modern: false,
      stateless: true,
      // Quick Tunnels do not support SSE; tool replies must be JSON.
      enableJsonResponse: true,
      eventStore: false,
      cors: false,
      createServer: async () => {
        const server = new Server(upstream.getServerVersion(), {
          capabilities,
          instructions: upstream.getInstructions(),
        });
        await proxyServer({ client: upstream, server, serverCapabilities: capabilities });
        return server;
      },
      onUnhandledRequest: async (request, response) => {
        if (request.method === 'GET' && request.url === '/healthz') {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ ready: true }));
        } else {
          response.writeHead(404).end();
        }
      },
    });
  } catch (error) {
    closing = true;
    await upstream.close();
    throw error;
  }

  return {
    async close() {
      if (closing) return;
      closing = true;
      try {
        await http.close();
      } finally {
        await upstream.close();
      }
    },
  };
}
