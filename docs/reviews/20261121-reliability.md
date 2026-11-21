# Local connection reliability review

Reviewed on November 21, 2026, against base `68ec4f6`.

## Scope and verdict

Approve the bounded implementation for activation on the existing Mac.
The review covered the complete changed source, the health checker and recovery
policy, the CLI, the isolated lifecycle test, and the reliability instructions.

The service keeps the existing loopback binding, upstream process, fixed
ngrok hostname, and private MCP path. Readiness now requires a fresh response
and an answering Desktop Commander subprocess. Tunnel recovery preserves
the upstream process; repeated local failures restart the service. Public
failure retries, tunnel restarts, and wake assertions have finite boundaries.

The implementation review found a risk of restarting ngrok repeatedly for
HTTP authentication, billing, or quota failures. The repair classifies those
responses and suppresses tunnel restarts. The focused checker and policy
assertions pass after that repair.

## Validation

The declared Node 22.23.4 runtime ran:

- `npm run check`: passed.
- `node --test tests/bridge.test.mjs tests/settings.test.mjs tests/reliability.test.mjs`:
  eight tests passed.
- After the HTTP classification repair, `node --test tests/reliability.test.mjs`:
  four tests passed.
- `git diff --check`: passed.
- The direct-prose checker on `docs/reliability.md`: passed.

The isolated lifecycle test ran a real bridge, Desktop Commander subprocess,
temporary tunnel child, and timed macOS wake assertion. A terminal session
accepted input after the tunnel child exited and restarted. The wake lease
expired and responded to renewal and early release.

The user explicitly authorized focused Node tests in place of the unavailable
CodeQL-derived selection. These results establish the inspected assertions;
they leave general network availability and future sleep/wake cycles open.

## Operational limits

Public probes run every ten healthy minutes, so detection can take ten minutes
before failure retries. Intentional sleep, a closed lid, exhausted battery,
and unavailable networks can still suspend access. Native ngrok heartbeats
and service readiness checks leave the remote-work deadline unchanged.

The private ngrok configuration backup and the machine-local connection state
remain outside Git. Live activation and verification will be recorded separately.
