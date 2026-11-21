/** Protect the existing tunnel configuration and the free stable-hostname boundary. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ngrokOrigin, parseSettings, validateSecureProfile } from '../scripts/settings.mjs';

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

test('private tunnel settings retain the tunnel identity and require loopback health', () => {
  const secure = {
    ...base, tunnel: {
      provider: 'openai-tunnel', executablePath: '/usr/local/bin/tunnel-client',
      configPath: '/private/local-mac.yaml',
      tunnelId: 'tunnel_' + 'c'.repeat(32), healthOrigin: 'http://127.0.0.1:8932/',
    },
  };
  const parsed = parseSettings(secure);
  assert.equal(parsed.tunnel.healthOrigin, 'http://127.0.0.1:8932');
  assert.deepEqual(parseSettings(JSON.parse(JSON.stringify(parsed))), parsed);
  for (const change of [
    { healthOrigin: 'http://0.0.0.0:8932' },
    { healthOrigin: 'https://example.com:8932' },
    { healthOrigin: 'http://127.0.0.1:8932/other' },
    { configPath: 'relative.yaml' }, { tunnelId: 'not-a-tunnel' },
    { origin: 'https://assigned.ngrok-free.dev' },
  ]) assert.throws(() => parseSettings({ ...secure, tunnel: { ...secure.tunnel, ...change } }));
});

test('native profile activation rejects tunnel, target, health, and secret-reference mismatches', () => {
  const settings = { ...base, tunnel: { tunnelId: 'tunnel_'+'e'.repeat(32), healthOrigin: 'http://127.0.0.1:8932' } };
  const profile = {
    control_plane: { tunnel_id: settings.tunnel.tunnelId, api_key: 'file:/private/runtime.key' },
    health: { listen_addr: '127.0.0.1:8932' },
    mcp: { server_urls: [{ channel: 'main', url: `http://127.0.0.1:8931${base.endpointPath}` }] },
  };
  assert.equal(validateSecureProfile(settings, profile), profile);
  for (const part of ['tunnel', 'target', 'health', 'secret']) {
    const changed = structuredClone(profile);
    if (part === 'tunnel') changed.control_plane.tunnel_id = 'tunnel_'+'f'.repeat(32);
    if (part === 'target') changed.mcp.server_urls[0].url = 'http://127.0.0.1:9999/mcp/other';
    if (part === 'health') changed.health.listen_addr = '0.0.0.0:8932';
    if (part === 'secret') changed.control_plane.api_key = 'literal-secret';
    assert.throws(() => validateSecureProfile(settings, changed));
  }
});
