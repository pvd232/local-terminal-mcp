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

/** Read the persistent local port, endpoint path, and tunnel executable. */
export function readSettings() {
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  assert.ok(Number.isInteger(settings.port) && settings.port > 0 && settings.port < 65536, 'Invalid port.');
  assert.match(settings.endpointPath, /^\/mcp\/[a-f0-9]{48}$/);
  assert.equal(typeof settings.cloudflaredPath, 'string');
  assert.ok(settings.cloudflaredPath.startsWith('/'), 'cloudflaredPath must be absolute.');
  return settings;
}

/** Read status written by the current background-service process. */
export function readCurrent() {
  return JSON.parse(readFileSync(currentPath, 'utf8'));
}
