/** Own machine-local configuration and derived service status outside Git. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
export const stateDirectory = join(homedir(), 'Library', 'Application Support', 'local-terminal-mcp');
export const settingsPath = join(stateDirectory, 'config.json');
export const currentPath = join(stateDirectory, 'current.json');
export const serviceLabel = 'com.pvd232.local-terminal-mcp';
export const agentPath = join(homedir(), 'Library', 'LaunchAgents', `${serviceLabel}.plist`);

/** Replace one complete local JSON file without publishing partial bytes. */
export function writeJson(path, value) {
  mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

/** Canonicalize one free ngrok account hostname while rejecting paid-domain inputs. */
export function ngrokOrigin(value) {
  assert.equal(typeof value, 'string', 'Provide the free ngrok account hostname.');
  const origin = new URL(value.includes('://') ? value : `https://${value}`);
  assert.equal(origin.protocol, 'https:');
  assert.match(origin.hostname, /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.ngrok-free\.(?:app|dev)$/);
  assert.equal(origin.pathname, '/');
  assert.equal(`${origin.username}${origin.password}${origin.port}${origin.search}${origin.hash}`, '');
  return origin.origin;
}

/** Validate configuration and resolve the original Quick Tunnel file format. */
export function parseSettings(settings) {
  assert.ok(Number.isInteger(settings.port) && settings.port > 0 && settings.port < 65536, 'Invalid port.');
  assert.match(settings.endpointPath, /^\/mcp\/[a-f0-9]{48}$/);
  const tunnel = settings.tunnel ?? {
    provider: 'cloudflare-quick', executablePath: settings.cloudflaredPath,
  };
  assert.ok(['cloudflare-quick', 'ngrok'].includes(tunnel.provider), 'Invalid tunnel provider.');
  assert.equal(typeof tunnel.executablePath, 'string');
  assert.ok(tunnel.executablePath.startsWith('/'), 'Tunnel executablePath must be absolute.');
  const resolved = { provider: tunnel.provider, executablePath: tunnel.executablePath };
  if (tunnel.provider === 'ngrok') resolved.origin = ngrokOrigin(tunnel.origin);
  else assert.equal(tunnel.origin, undefined, 'Quick Tunnel addresses are assigned at startup.');
  return { port: settings.port, endpointPath: settings.endpointPath, tunnel: resolved };
}

/** Read the persistent local port, endpoint path, and selected tunnel. */
export function readSettings() {
  return parseSettings(JSON.parse(readFileSync(settingsPath, 'utf8')));
}

/** Read status written by the current background-service process. */
export function readCurrent() {
  return JSON.parse(readFileSync(currentPath, 'utf8'));
}
