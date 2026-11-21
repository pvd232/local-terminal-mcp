/** Check HTTP readiness through the real subprocess, with scoped DNS fallback. */
import { randomBytes } from 'node:crypto';
import { lookup } from 'node:dns';
import { Resolver } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

/** Resolve public tunnel hosts without changing the Mac's network settings. */
function lookupTunnel(hostname, options, callback) {
  let settled = false;
  let fallingBack = false;
  const finish = (error, address, family = 4) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (error) callback(error);
    else if (options.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  };
  const fallback = async () => {
    if (settled || fallingBack) return;
    fallingBack = true;
    const resolver = new Resolver({ timeout: 1500, tries: 1 });
    resolver.setServers(['1.1.1.1', '8.8.8.8']);
    try {
      const addresses = await resolver.resolve4(hostname);
      if (!addresses.length) throw Object.assign(new Error('No DNS answer'), { code: 'ENOTFOUND' });
      finish(null, addresses[0]);
    } catch (error) {
      finish(error);
    } finally {
      resolver.cancel();
    }
  };
  const timer = setTimeout(() => void fallback(), 1500);
  lookup(hostname, { family: 4 }, (error, address, family) => {
    if (settled) return;
    clearTimeout(timer);
    if (error) void fallback();
    else finish(null, address, family);
  });
}

/** Require a fresh, nonce-matched response from this bridge within one deadline. */
export async function checkHealth(origin, timeoutMs = 8000) {
  const nonce = randomBytes(16).toString('hex');
  const started = Date.now();
  const url = new URL('/healthz', origin);
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => req.destroy(Object.assign(new Error('Health deadline exceeded'), {
      code: 'ETIMEDOUT',
    })), timeoutMs);
    const req = request(url, {
      lookup: lookupTunnel,
      headers: { 'x-local-terminal-probe': nonce, 'ngrok-skip-browser-warning': '1' },
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 4096) req.destroy(new Error('Oversized health response'));
      });
      response.on('error', error => { clearTimeout(timer); reject(error); });
      response.on('end', () => {
        clearTimeout(timer);
        try {
          if (response.statusCode !== 200) {
            throw Object.assign(new Error('Health HTTP response failed'), { code: `EHTTP${response.statusCode}` });
          }
          if (response.headers['x-local-terminal-probe'] !== nonce || JSON.parse(body).ready !== true) {
            throw Object.assign(new Error('Bridge readiness failed'), { code: 'EUNHEALTHY' });
          }
          resolve({ ready: true, latencyMs: Date.now() - started });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', error => { clearTimeout(timer); reject(error); });
    req.end();
  });
}
