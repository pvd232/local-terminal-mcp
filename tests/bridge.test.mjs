/** Test real subprocess forwarding, JSON replies, and request isolation. */
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import test from 'node:test';
import { startBridge } from '../scripts/bridge.mjs';
import { rpc, verify } from '../scripts/verify.mjs';

test('JSON bridge preserves subprocess sessions across independent HTTP requests', async () => {
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const { port } = reservation.address();
  await new Promise(resolve => reservation.close(resolve));
  const endpointPath = '/mcp/local-test';
  const failures = [];
  const bridge = await startBridge({ port, endpointPath, onFailure: error => failures.push(error) });
  const endpoint = `http://127.0.0.1:${port}${endpointPath}`;
  try {
    const report = await verify(endpoint);
    assert.ok(report.toolCount >= 3);
    const malformed = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: '{',
    });
    assert.equal(malformed.status, 400);
    await rpc(endpoint, 'ping');
    assert.equal((await fetch(`http://127.0.0.1:${port}/mcp/wrong`)).status, 404);
    assert.deepEqual(await (await fetch(`http://127.0.0.1:${port}/healthz`)).json(), { ready: true });
    assert.deepEqual(failures, []);
  } finally {
    await bridge.close();
    await bridge.close();
  }
});
