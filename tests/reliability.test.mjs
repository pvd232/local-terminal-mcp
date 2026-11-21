/** Exercise readiness failures, bounded recovery, and real isolated child lifecycles. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { checkHealth } from '../scripts/health.mjs';
import { publicRetryDelay, remoteWorkSeconds, shouldRestartTunnel } from '../scripts/recovery.mjs';
import { rpc } from '../scripts/verify.mjs';

/** Own one ephemeral loopback server for a readiness response. */
async function listen(handler) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

/** Wait for one service-owned observation under a fixed deadline. */
async function waitFor(read, accepts, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const value = await read();
      if (accepts(value)) return value;
    } catch {}
    await delay(50);
  }
  throw new Error('Service observation did not arrive before its deadline');
}

test('readiness requires a fresh matching nonce and a ready response', async () => {
  let answer = 'ready';
  const { server, origin } = await listen((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (answer === 'quota') response.statusCode = 429;
    if (answer !== 'stale') response.setHeader('x-local-terminal-probe', request.headers['x-local-terminal-probe']);
    response.end(JSON.stringify({ ready: answer !== 'unready' }));
  });
  try {
    assert.equal((await checkHealth(origin)).ready, true);
    answer = 'stale';
    await assert.rejects(checkHealth(origin), { code: 'EUNHEALTHY' });
    answer = 'unready';
    await assert.rejects(checkHealth(origin), { code: 'EUNHEALTHY' });
    answer = 'quota';
    await assert.rejects(checkHealth(origin), { code: 'EHTTP429' });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('a health response that never finishes reaches its total deadline', async () => {
  const { server, origin } = await listen(() => {});
  try {
    await assert.rejects(checkHealth(origin, 80), { code: 'ETIMEDOUT' });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('recovery waits for repeated failures, skips offline errors, and bounds retry frequency', () => {
  const base = { stable: true, errorCode: 'EUNHEALTHY', failures: 3, startedAt: 0, now: 300_000 };
  assert.equal(shouldRestartTunnel(base), true);
  assert.equal(shouldRestartTunnel({ ...base, failures: 2 }), false);
  assert.equal(shouldRestartTunnel({ ...base, now: 299_999 }), false);
  assert.equal(shouldRestartTunnel({ ...base, stable: false }), false);
  for (const errorCode of ['ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'ECONNREFUSED',
    'EHTTP401', 'EHTTP402', 'EHTTP403', 'EHTTP429']) {
    assert.equal(shouldRestartTunnel({ ...base, errorCode }), false);
  }
  assert.deepEqual([1, 2, 3, 4, 5, 100].map(publicRetryDelay),
    [60_000, 120_000, 240_000, 480_000, 600_000, 600_000]);
  assert.equal(remoteWorkSeconds(2001, 1000), 2);
  assert.equal(remoteWorkSeconds(999, 1000), 0);
});

test('an isolated supervisor preserves terminal sessions after tunnel exit and expires its wake lease', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'local-terminal-reliability-'));
  const reservation = await listen(() => {});
  const port = reservation.server.address().port;
  await new Promise(resolve => reservation.server.close(resolve));
  const fakeTunnel = join(directory, 'tunnel');
  await writeFile(fakeTunnel, '#!/bin/sh\nexec /bin/sleep 60\n', { mode: 0o700 });
  const settings = {
    port, endpointPath: `/mcp/${'b'.repeat(48)}`,
    tunnel: { provider: 'cloudflare-quick', executablePath: fakeTunnel },
    remoteWorkUntil: Date.now() + 5000,
  };
  const configPath = join(directory, 'config.json');
  await writeFile(configPath, JSON.stringify(settings), { mode: 0o600 });
  const service = spawn(process.execPath, ['scripts/service.mjs'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, LOCAL_TERMINAL_MCP_STATE_DIR: directory },
    stdio: 'ignore',
  });
  const exited = once(service, 'exit');
  const state = async () => JSON.parse(await readFile(join(directory, 'current.json'), 'utf8'));
  const endpoint = `http://127.0.0.1:${port}${settings.endpointPath}`;
  let terminalPid;
  try {
    const before = await waitFor(state, value => value.bridgeHealthy && value.tunnelPid && value.remoteWorkUntil);
    const session = await rpc(endpoint, 'tools/call', {
      name: 'start_process', arguments: { command: 'cat', timeout_ms: 500 },
    });
    const output = session.content.map(item => item.text ?? '').join('\n');
    terminalPid = Number(output.match(/\bPID\D+(\d+)/i)?.[1]);
    assert.ok(terminalPid);
    assert.equal(before.pid, service.pid);
    process.kill(before.tunnelPid, 'SIGTERM');
    const after = await waitFor(state, value =>
      value.tunnelRestarts === 1 && value.tunnelPid && value.tunnelPid !== before.tunnelPid);
    assert.equal(after.pid, before.pid);
    const echoed = await rpc(endpoint, 'tools/call', {
      name: 'interact_with_process',
      arguments: { pid: terminalPid, input: 'SESSION_SURVIVED_TUNNEL_RECOVERY\n', timeout_ms: 500 },
    });
    assert.ok(echoed.content.some(item => item.text?.includes('SESSION_SURVIVED_TUNNEL_RECOVERY')));
    await waitFor(state, value => value.remoteWorkUntil === null);
    settings.remoteWorkUntil = Date.now() + 60_000;
    await writeFile(configPath, JSON.stringify(settings));
    service.kill('SIGUSR1');
    await waitFor(state, value => value.remoteWorkUntil !== null);
    settings.remoteWorkUntil = 0;
    await writeFile(configPath, JSON.stringify(settings));
    service.kill('SIGUSR1');
    await waitFor(state, value => value.remoteWorkUntil === null);
    assert.equal((await checkHealth(endpoint)).ready, true);
  } finally {
    if (terminalPid) await rpc(endpoint, 'tools/call', {
      name: 'force_terminate', arguments: { pid: terminalPid },
    }).catch(() => {});
    service.kill('SIGTERM');
    const kill = setTimeout(() => service.kill('SIGKILL'), 7000);
    await exited;
    clearTimeout(kill);
    await rm(directory, { recursive: true, force: true });
  }
});
