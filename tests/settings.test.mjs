/** Protect the existing tunnel configuration and the free stable-hostname boundary. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ngrokOrigin, parseSettings } from '../scripts/settings.mjs';

const base = { port: 8931, endpointPath: `/mcp/${'a'.repeat(48)}` };

test('the original configuration still resolves to its Quick Tunnel executable', () => {
  assert.deepEqual(parseSettings({ ...base, cloudflaredPath: '/opt/homebrew/bin/cloudflared' }), {
    ...base, tunnel: { provider: 'cloudflare-quick', executablePath: '/opt/homebrew/bin/cloudflared' },
  });
});

test('the configured free hostname survives serialization and takes precedence over legacy state', () => {
  const settings = {
    ...base,
    cloudflaredPath: '/old/cloudflared',
    tunnel: { provider: 'ngrok', executablePath: '/opt/homebrew/bin/ngrok', origin: 'https://assigned.ngrok-free.dev/' },
  };
  const resolved = parseSettings(JSON.parse(JSON.stringify(settings)));
  assert.equal(resolved.tunnel.origin, 'https://assigned.ngrok-free.dev');
  assert.equal(resolved.tunnel.provider, 'ngrok');
  assert.equal(resolved.endpointPath, base.endpointPath);
  assert.equal(resolved.cloudflaredPath, undefined);
  assert.deepEqual(parseSettings(JSON.parse(JSON.stringify(resolved))), resolved);
  assert.equal(ngrokOrigin('assigned.ngrok-free.app'), 'https://assigned.ngrok-free.app');
});

test('paid domains, URL credentials, paths, ports, and insecure schemes are rejected', () => {
  for (const value of [
    'https://chosen.ngrok.app', 'https://example.com', 'http://assigned.ngrok-free.dev',
    'https://user:password@assigned.ngrok-free.dev', 'https://assigned.ngrok-free.dev:8443',
    'https://assigned.ngrok-free.dev/mcp', 'https://assigned.ngrok-free.dev?q=1',
    'https://assigned.ngrok-free.dev#fragment', 'https://-invalid.ngrok-free.dev', undefined,
  ]) assert.throws(() => ngrokOrigin(value));
  assert.throws(() => parseSettings({ ...base, tunnel: { provider: 'ngrok', executablePath: '/ngrok' } }));
  assert.throws(() => parseSettings({ ...base, tunnel: { provider: 'unknown', executablePath: '/tunnel' } }));
});
