/** Own machine-local configuration and derived service status outside Git. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
export const stateDirectory = process.env.LOCAL_TERMINAL_MCP_STATE_DIR
  ?? join(homedir(), 'Library', 'Application Support', 'local-terminal-mcp');
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
  assert.ok(['cloudflare-quick', 'ngrok', 'openai-tunnel'].includes(tunnel.provider), 'Invalid tunnel provider.');
  assert.equal(typeof tunnel.executablePath, 'string');
  assert.ok(tunnel.executablePath.startsWith('/'), 'Tunnel executablePath must be absolute.');
  const resolved = { provider: tunnel.provider, executablePath: tunnel.executablePath };
  if (tunnel.provider === 'ngrok') resolved.origin = ngrokOrigin(tunnel.origin);
  else if (tunnel.provider === 'openai-tunnel') {
    assert.match(tunnel.tunnelId, /^tunnel_(?:[a-z0-9]{4}_)?[a-z0-9]{32}$/);
    assert.equal(typeof tunnel.configPath, 'string');
    assert.ok(tunnel.configPath.startsWith('/'), 'Native configuration path must be absolute.');
    const health = new URL(tunnel.healthOrigin);
    assert.equal(health.protocol, 'http:');
    assert.equal(health.hostname, '127.0.0.1');
    assert.ok(Number(health.port) > 0, 'Use a fixed loopback health port.');
    assert.equal(health.pathname, '/');
    assert.equal(health.username + health.password + health.search + health.hash, '');
    assert.equal(tunnel.origin, undefined, 'Private tunnels have no public Mac origin.');
    resolved.tunnelId = tunnel.tunnelId;
    resolved.configPath = tunnel.configPath;
    resolved.healthOrigin = health.origin;
  } else assert.equal(tunnel.origin, undefined, 'Quick Tunnel addresses are assigned at startup.');
  const parsed = { port: settings.port, endpointPath: settings.endpointPath, tunnel: resolved };
  if (settings.remoteWorkUntil !== undefined) {
    assert.ok(Number.isSafeInteger(settings.remoteWorkUntil) && settings.remoteWorkUntil >= 0,
      'remoteWorkUntil must be a nonnegative epoch time in milliseconds.');
    parsed.remoteWorkUntil = settings.remoteWorkUntil;
  }
  return parsed;
}

/** Read the persistent local port, endpoint path, and selected tunnel. */
export function readSettings() {
  return parseSettings(JSON.parse(readFileSync(settingsPath, 'utf8')));
}

/** Read status written by the current background-service process. */
export function readCurrent() {
  return JSON.parse(readFileSync(currentPath, 'utf8'));
}

/** Bind a native profile to this Mac service and its configured tunnel identity. */
export function validateSecureProfile(settings, profile) {
  assert.equal(profile?.control_plane?.tunnel_id, settings.tunnel.tunnelId, 'Native profile tunnel ID differs.');
  assert.equal(profile.health?.listen_addr, new URL(settings.tunnel.healthOrigin).host, 'Native health listener differs.');
  assert.match(profile.control_plane.api_key, /^(?:file:\/[^\n]+|env:[A-Za-z_][A-Za-z0-9_]*)$/,
    'Use a file or environment reference for the runtime secret.');
  const main = profile.mcp?.server_urls?.filter(binding => binding.channel === 'main') ?? [];
  assert.equal(main.length, 1, 'Configure exactly one main MCP binding.');
  assert.equal(main[0].url, `http://127.0.0.1:${settings.port}${settings.endpointPath}`,
    'Native profile must target this Mac service.');
  return profile;
}

/** Read the native YAML through a safe parser before activating the transport. */
export function readSecureProfile(settings) {
  return validateSecureProfile(settings, yaml.safeLoad(readFileSync(settings.tunnel.configPath, 'utf8')));
}
