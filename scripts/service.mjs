/** Supervise subprocess health, tunnel recovery, and timed remote-work wake leases. */
import { spawn } from 'node:child_process';
import { startBridge } from './bridge.mjs';
import { checkHealth } from './health.mjs';
import { publicRetryDelay, remoteWorkSeconds, shouldRestartTunnel } from './recovery.mjs';
import { currentPath, readSettings, writeJson } from './settings.mjs';

const settings = readSettings();
const current = {
  pid: process.pid, startedAt: new Date().toISOString(), status: 'starting', endpoint: null,
  bridgeHealthy: false, publicHealthy: false, checkedAt: null, publicCheckedAt: null,
  lastHealthyAt: null, lastError: null, tunnelRestarts: 0, tunnelPid: null, remoteWorkUntil: null,
};
const stable = settings.tunnel.provider === 'ngrok';
let bridge;
let tunnel;
let tunnelTimer;
let heartbeatTimer;
let awake;
let awakeUntil = 0;
let stopping;
let localFailures = 0;
let publicFailures = 0;
let nextPublicCheck = 0;
let lastTunnelStart = 0;
let exitFailures = 0;

/** Persist only classified errors; endpoint paths and provider logs remain private. */
function save() {
  writeJson(currentPath, current);
}

/** End a job even when a broken upstream refuses to close. */
function stop(code) {
  if (stopping) return stopping;
  stopping = (async () => {
    clearTimeout(heartbeatTimer);
    clearTimeout(tunnelTimer);
    const deadline = setTimeout(() => {
      tunnel?.kill('SIGKILL');
      process.exit(code);
    }, 5000);
    deadline.unref();
    awake?.kill('SIGTERM');
    tunnel?.kill('SIGTERM');
    current.status = 'stopped';
    current.bridgeHealthy = false;
    current.publicHealthy = false;
    save();
    try {
      await bridge?.close();
    } finally {
      process.exit(code);
    }
  })();
  return stopping;
}

/** Restart only the tunnel so healthy terminal sessions retain their owner. */
function startTunnel() {
  if (stopping) return;
  const args = stable ? [
    'http', `http://127.0.0.1:${settings.port}`, `--url=${settings.tunnel.origin}`,
    '--log=stdout', '--log-format=json', '--inspect=false',
  ] : [
    'tunnel', '--no-autoupdate', '--config', '/dev/null',
    '--protocol', 'http2', '--url', `http://127.0.0.1:${settings.port}`,
  ];
  current.status = 'tunnel-starting';
  current.publicHealthy = false;
  if (stable) current.endpoint = `${settings.tunnel.origin}${settings.endpointPath}`;
  else current.endpoint = null;
  lastTunnelStart = Date.now();
  nextPublicCheck = 0;
  save();
  const child = spawn(settings.tunnel.executablePath, args, {
    stdio: ['ignore', stable ? 'pipe' : 'ignore', 'pipe'],
  });
  tunnel = child;
  current.tunnelPid = child.pid ?? null;
  save();
  let recentOutput = '';
  const output = chunk => {
    process.stderr.write(chunk);
    if (stable) return;
    recentOutput = `${recentOutput}${chunk}`.slice(-8192);
    const match = recentOutput.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (!current.endpoint && match) {
      current.endpoint = `${match[0]}${settings.endpointPath}`;
      save();
    }
  };
  child.stdout?.on('data', output);
  child.stderr.on('data', output);
  let ended = false;
  const restart = () => {
    if (ended || stopping || tunnel !== child) return;
    ended = true;
    tunnel = undefined;
    current.tunnelPid = null;
    current.status = 'degraded';
    current.publicHealthy = false;
    current.lastError = 'tunnel-exited';
    current.tunnelRestarts += 1;
    save();
    const wait = Math.min(30_000, 1000 * 2 ** Math.min(exitFailures++, 5));
    tunnelTimer = setTimeout(startTunnel, wait);
  };
  child.on('error', restart);
  child.on('exit', restart);
}

/** Hold idle sleep only until an explicitly requested remote-work deadline. */
function updateWakeLease() {
  const until = readSettings().remoteWorkUntil ?? 0;
  if (until === awakeUntil && (awake || until <= Date.now())) return;
  awake?.kill('SIGTERM');
  awake = undefined;
  awakeUntil = until;
  current.remoteWorkUntil = until > Date.now() ? new Date(until).toISOString() : null;
  if (until <= Date.now()) return;
  const child = spawn('/usr/bin/caffeinate', [
    '-i', '-t', String(remoteWorkSeconds(until)), '-w', String(process.pid),
  ], { stdio: 'ignore' });
  awake = child;
  child.on('error', () => {
    if (awake === child) {
      awake = undefined;
      current.remoteWorkUntil = null;
      current.lastError = 'wake-lease-failed';
      save();
    }
  });
  child.on('exit', () => {
    if (awake === child) {
      awake = undefined;
      current.remoteWorkUntil = null;
      save();
    }
  });
}

/** Check locally each minute and publicly at most every ten healthy minutes. */
async function heartbeat() {
  if (stopping) return;
  try {
    updateWakeLease();
    current.checkedAt = new Date().toISOString();
    try {
      await checkHealth(`http://127.0.0.1:${settings.port}`);
      current.bridgeHealthy = true;
      localFailures = 0;
    } catch (error) {
      current.bridgeHealthy = false;
      current.publicHealthy = false;
      current.status = 'degraded';
      current.lastError = `local-${error.code ?? 'failed'}`;
      localFailures += 1;
      save();
      if (localFailures >= 3) {
        console.error('Local subprocess failed three readiness checks; restarting service.');
        void stop(1);
        return;
      }
    }
    if (current.bridgeHealthy && current.endpoint && Date.now() >= nextPublicCheck) {
      current.publicCheckedAt = new Date().toISOString();
      try {
        await checkHealth(current.endpoint);
        current.publicHealthy = true;
        current.lastHealthyAt = new Date().toISOString();
        current.lastError = null;
        current.status = 'ready';
        publicFailures = 0;
        exitFailures = 0;
        nextPublicCheck = Date.now() + 600_000;
      } catch (error) {
        current.publicHealthy = false;
        current.status = 'degraded';
        current.lastError = `public-${error.code ?? 'failed'}`;
        publicFailures += 1;
        nextPublicCheck = Date.now() + publicRetryDelay(publicFailures);
        if (tunnel && shouldRestartTunnel({
          stable, errorCode: error.code, failures: publicFailures, startedAt: lastTunnelStart,
        })) {
          console.error('Public readiness failed repeatedly; restarting only the tunnel.');
          const failedTunnel = tunnel;
          failedTunnel.kill('SIGTERM');
          setTimeout(() => {
            if (tunnel === failedTunnel) failedTunnel.kill('SIGKILL');
          }, 5000).unref();
          publicFailures = 0;
        }
      }
    }
    save();
  } catch (error) {
    console.error(`Heartbeat failed: ${error.code ?? error.name}`);
  } finally {
    if (!stopping) heartbeatTimer = setTimeout(() => void heartbeat(), 60_000);
  }
}

process.on('SIGTERM', () => void stop(0));
process.on('SIGINT', () => void stop(0));
process.on('SIGUSR1', () => {
  if (!stopping) { updateWakeLease(); save(); }
});

try {
  save();
  bridge = await startBridge({
    ...settings,
    onFailure: () => {
      console.error('The local Desktop Commander process exited; restarting service.');
      void stop(1);
    },
  });
  current.status = 'bridge-ready';
  save();
  startTunnel();
  void heartbeat();
} catch (error) {
  console.error(`Service failed: ${error.code ?? error.name}`);
  await stop(1);
}
