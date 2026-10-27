/** Install, operate, and verify the user's local terminal MCP background job. */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {
  agentPath, currentPath, readCurrent, readSettings, repositoryRoot,
  serviceLabel, settingsPath, stateDirectory, writeJson,
} from './settings.mjs';
import { verify } from './verify.mjs';

const domain = `gui/${process.getuid()}`;
const target = `${domain}/${serviceLabel}`;

/** Run a native command and retain its error when the operation fails. */
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `${command} exited ${result.status}`);
  return result.stdout.trim();
}

/** Escape literal machine paths for a generated launchd property list. */
function xml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

/** Build launchd's projection of this checkout, runtime, and local log paths. */
function propertyList() {
  const environmentPath = `${dirname(process.execPath)}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${serviceLabel}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(join(repositoryRoot, 'scripts/service.mjs'))}</string></array>
<key>WorkingDirectory</key><string>${xml(repositoryRoot)}</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(environmentPath)}</string><key>HOME</key><string>${xml(homedir())}</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>10</integer>
<key>ProcessType</key><string>Background</string>
<key>StandardOutPath</key><string>${xml(join(stateDirectory, 'service.log'))}</string>
<key>StandardErrorPath</key><string>${xml(join(stateDirectory, 'service.err.log'))}</string>
</dict></plist>\n`;
}

/** Check the actual loopback bridge rather than trusting an old status file. */
async function requireBridge(settings) {
  const response = await fetch(`http://127.0.0.1:${settings.port}/healthz`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok || !(await response.json()).ready) throw new Error('The local bridge is not ready.');
}

/** Wait for both the bridge and the assigned public tunnel to answer. */
async function waitForService() {
  const settings = readSettings();
  const deadline = Date.now() + 120_000;
  let lastFailure = 'The public tunnel has not assigned an address.';
  while (Date.now() < deadline) {
    try {
      await requireBridge(settings);
      const current = readCurrent();
      if (current.endpoint && current.status !== 'stopped') {
        const health = await fetch(new URL('/healthz', current.endpoint), {
          signal: AbortSignal.timeout(3000),
        });
        if (health.ok && (await health.json()).ready) return;
        lastFailure = `Public tunnel health returned HTTP ${health.status}.`;
      }
    } catch (error) {
      lastFailure = `${error.message}${error.cause?.code ? ` (${error.cause.code})` : ''}`;
      // launchd and the tunnel can each need time to establish a connection.
    }
    await delay(500);
  }
  throw new Error(`Bridge and tunnel did not become ready within 120 seconds: ${lastFailure}. Check service.err.log.`);
}

/** Load the installed agent once; starting an active job preserves its URL. */
async function start() {
  if (!existsSync(agentPath)) throw new Error('Run npm run terminal -- install first.');
  const loaded = spawnSync('/bin/launchctl', ['print', target], { stdio: 'ignore' });
  if (loaded.status !== 0) run('/bin/launchctl', ['bootstrap', domain, agentPath]);
  await waitForService();
  console.log('Bridge and tunnel are ready. The background job restarts at login.');
}

try {
  const action = process.argv[2] ?? 'status';
  if (action === 'install') {
    mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
    if (!existsSync(settingsPath)) {
      const cloudflaredPath = run('/usr/bin/which', ['cloudflared']);
      writeJson(settingsPath, {
        port: 8931,
        endpointPath: `/mcp/${randomBytes(24).toString('hex')}`,
        cloudflaredPath,
      });
    }
    readSettings();
    mkdirSync(dirname(agentPath), { recursive: true });
    writeFileSync(agentPath, propertyList(), { mode: 0o600 });
    run('/usr/bin/plutil', ['-lint', agentPath]);
    await start();
  } else if (action === 'start') {
    await start();
  } else if (action === 'stop') {
    const loaded = spawnSync('/bin/launchctl', ['print', target], { stdio: 'ignore' });
    if (loaded.status === 0) run('/bin/launchctl', ['bootout', target]);
    console.log('Background job stopped. Configuration and logs are retained.');
  } else if (action === 'status' || action === 'url' || action === 'verify') {
    const settings = readSettings();
    await requireBridge(settings);
    const current = readCurrent();
    if (current.status === 'stopped') throw new Error('The background job is stopped.');
    if (action === 'status') {
      console.log(JSON.stringify({ bridgeReady: true, tunnelAddressAssigned: Boolean(current.endpoint), pid: current.pid }, null, 2));
    } else if (action === 'url') {
      if (!current.endpoint) throw new Error('The tunnel is still starting.');
      console.log(current.endpoint);
    } else {
      const endpoint = process.argv.includes('--local')
        ? `http://127.0.0.1:${settings.port}${settings.endpointPath}` : current.endpoint;
      if (!endpoint) throw new Error('The tunnel is still starting.');
      console.log(JSON.stringify(await verify(endpoint), null, 2));
    }
  } else {
    throw new Error('Choose install, start, stop, status, url, or verify [--local].');
  }
} catch (error) {
  console.error(error.message);
  console.error(`Local status: ${currentPath}`);
  process.exitCode = 1;
}
