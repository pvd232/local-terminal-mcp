/** Decide when readiness failures warrant recovery or a temporary wake assertion. */
const restartSuppressedErrors = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'ECONNREFUSED',
  'EHTTP401', 'EHTTP402', 'EHTTP403', 'EHTTP429']);

/** Back off public probes while keeping the steady-state request rate bounded. */
export function publicRetryDelay(failures) {
  return Math.min(600_000, 60_000 * 2 ** Math.min(Math.max(0, failures - 1), 4));
}

/** Recover a fixed tunnel only after repeated failures and its startup grace. */
export function shouldRestartTunnel({ stable, errorCode, failures, startedAt, now = Date.now() }) {
  return stable && !restartSuppressedErrors.has(errorCode) && failures >= 3 && now - startedAt >= 300_000;
}

/** Convert a remote-work deadline into a bounded remaining assertion duration. */
export function remoteWorkSeconds(until, now = Date.now()) {
  return Math.max(0, Math.ceil((until - now) / 1000));
}
