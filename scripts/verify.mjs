/** Exercise terminal execution and a persistent session through an MCP URL. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

/** Send a JSON MCP request and reject transport or protocol failures. */
export async function rpc(endpoint, method, params = {}, id = 1) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-03-26',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    signal: AbortSignal.timeout(60_000),
  });
  assert.equal(response.status, 200, `HTTP ${response.status} for ${method}`);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const message = await response.json();
  assert.equal(message.id, id);
  assert.equal(message.error, undefined, JSON.stringify(message.error));
  return message.result;
}

/** Join text content returned by a Desktop Commander terminal tool. */
function resultText(result) {
  assert.notEqual(result.isError, true, JSON.stringify(result));
  return result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
}

/** Prove that separate HTTP calls reach the same live terminal process. */
export async function verify(endpoint) {
  await rpc(endpoint, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'local-terminal-verification', version: '0.1.0' },
  });
  const { tools } = await rpc(endpoint, 'tools/list');
  for (const name of ['start_process', 'interact_with_process', 'force_terminate']) {
    assert.ok(tools.some(tool => tool.name === name), `Missing tool: ${name}`);
  }
  const nonce = `LOCAL_MCP_${randomBytes(12).toString('hex')}`;
  const call = (name, args) => rpc(endpoint, 'tools/call', { name, arguments: args });
  const oneShot = resultText(await call('start_process', {
    command: `printf '${nonce}\\n'`, timeout_ms: 1000,
  }));
  assert.ok(oneShot.includes(nonce), 'The command did not return the fresh nonce.');

  let pid;
  try {
    const started = resultText(await call('start_process', { command: 'cat', timeout_ms: 1000 }));
    const match = started.match(/\bPID\D+(\d+)/i);
    assert.ok(match, `Missing process ID: ${started}`);
    pid = Number(match[1]);
    const echoed = resultText(await call('interact_with_process', {
      pid, input: `${nonce}_SESSION\n`, timeout_ms: 1000,
    }));
    assert.ok(echoed.includes(`${nonce}_SESSION`), 'The later call lost the process session.');
  } finally {
    if (pid) await call('force_terminate', { pid });
  }
  await Promise.all([rpc(endpoint, 'ping', {}, 1), rpc(endpoint, 'ping', {}, 1)]);
  return { toolCount: tools.length, freshCommand: true, persistentSession: true, concurrentIds: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const endpoint = process.env.MCP_VERIFY_URL;
  assert.ok(endpoint, 'Set MCP_VERIFY_URL to the endpoint to test.');
  console.log(JSON.stringify(await verify(endpoint), null, 2));
}
