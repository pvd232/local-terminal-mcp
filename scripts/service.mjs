/** Supervise the local bridge and free tunnel as one macOS background job. */
import { spawn } from 'node:child_process';
import { startBridge } from './bridge.mjs';
import { currentPath, readSettings, writeJson } from './settings.mjs';

const settings = readSettings();
const current = {
  pid: process.pid,
  startedAt: new Date().toISOString(),
  status: 'starting',
  endpoint: null,
};
let bridge;
let tunnel;
let stopping;

/** Release the tunnel and upstream before letting launchd restart a failed job. */
function stop(code) {
  if (stopping) return stopping;
  stopping = (async () => {
    tunnel?.kill('SIGTERM');
    try {
      await bridge?.close();
    } finally {
      current.status = 'stopped';
      writeJson(currentPath, current);
      process.exit(code);
    }
  })();
  return stopping;
}

process.on('SIGTERM', () => void stop(0));
process.on('SIGINT', () => void stop(0));

try {
  writeJson(currentPath, current);
  bridge = await startBridge({
    ...settings,
    onFailure: error => {
      console.error(error.message);
      void stop(1);
    },
  });
  current.status = 'bridge-ready';
  writeJson(currentPath, current);
  tunnel = spawn(settings.cloudflaredPath, [
    'tunnel', '--no-autoupdate', '--config', '/dev/null',
    '--protocol', 'http2', '--url', `http://127.0.0.1:${settings.port}`,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let recentOutput = '';
  tunnel.stderr.on('data', chunk => {
    process.stderr.write(chunk);
    recentOutput = `${recentOutput}${chunk}`.slice(-8192);
    const match = recentOutput.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (!current.endpoint && match) {
      current.endpoint = `${match[0]}${settings.endpointPath}`;
      current.status = 'tunnel-created';
      writeJson(currentPath, current);
      console.log('Tunnel address saved. Run npm run terminal -- url to view it.');
    }
  });
  tunnel.on('error', error => {
    console.error(`Tunnel failed: ${error.message}`);
    void stop(1);
  });
  tunnel.on('exit', code => {
    if (!stopping) {
      console.error(`Tunnel exited with code ${code}.`);
      void stop(1);
    }
  });
} catch (error) {
  console.error(`Service failed: ${error.message}`);
  await stop(1);
}
