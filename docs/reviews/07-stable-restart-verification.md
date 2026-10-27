# Review 7: Stable tunnel deployment and restart behavior

Verdict: **Approve** for the CLI repair and deployed service checks. A call
through the replacement connector in ChatGPTMOD awaits a refreshed chat tool
list. This is the implementing agent's completed self-review.

## Reviewed state

Base: `975fd7dd6c429e72cc95a1b7a663e1561ff497fd`.
The source and guide diff, excluding this review record, has SHA-256
`9d81ec8817fd7d861a4ef31652534ce112210151ca43819c2c43cb02318e6f43`.
Scope: `stop` and its dispatch in `scripts/terminal.mjs`, `README.md`,
`docs/stable-address.md`, and `docs/verification.md`. The provider implementation
and bridge remain at the source reviewed in Review 6.

## Resolved finding

**P2, blocking until repaired: an immediate start can observe an unloading
job.** The original `stop` branch returned as soon as `launchctl bootout`
returned. During migration, the following `start` still found the old job,
skipped bootstrap, and waited for a service that launchd subsequently removed.
An explicit bootstrap restored the service.

The required invariant is that a completed `stop` leaves the named job unloaded
before the next `start` checks it. `stop` now polls that exact launchd target
until removal, with a 15-second deadline and an explicit failure if the old job
remains. The existing `start` path then loads the job and checks public health.
The repair preserves configuration, logs, and the existing failure behavior for
native commands.

The observing check ran two immediate CLI stop/start cycles on this Mac. After
each stop, a separate `launchctl print` confirmed removal. Each following start
created a different service process and passed public health and MCP checks.
Remaining actionable source findings: 0.

## Deployment evidence

- The authenticated ngrok dashboard showed the existing account on **Free**
  with an assigned development hostname. Its local agent configuration passed
  `ngrok config check`; the installed agent is 3.39.13.
- The LaunchAgent now owns one ngrok tunnel and one Desktop Commander child.
  The temporary pilot and the previous cloudflared process exited.
- Service processes 17569, 18002, 18200, and 18309 used the same complete
  connector address. The private MCP path stayed unchanged.
- Public verification passed for all four service instances: 25 tools, fresh
  command output, a terminal session spanning calls, and concurrent request
  IDs. The final two restarts ran immediately after the repaired stop command.
- One long-lived verification process encountered a closed pooled HTTP
  connection after a restart. Fresh invocations of the shipped verification
  CLI passed for every recorded instance.
- The replacement Local Mac Terminal connector is connected at the fixed
  address. The permissions API confirms **Allow all actions** for its app ID.
  The previous connection is labeled Local Mac Terminal (Quick Tunnel).

The local `stable-tunnel-verification.json` receipt retains the endpoint digest,
process IDs, timestamps, and successful public results. Credentials and the
complete connector address remain in machine-local files.

## Selected validation and limits

Node 22.23.4 passed `npm run check` and all four tests under `npm test` after
the CLI repair. The real launchd cycles observe the asynchronous unload path;
the existing tests observe configuration parsing and bridge/session forwarding.
The prose checker, all 21 local documentation links, and `git diff --check`
passed for the revised guide and review record.

The native call attempted with the chat's earlier loaded connector failed after
the Quick Tunnel was stopped. The replacement connector's refreshed catalog
shows 12 write tools and 13 read tools. A successful model-originated call
remains a separate acceptance step. Logout,
reboot, and Mac sleep recovery remain unverified.
