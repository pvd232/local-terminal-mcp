# Review 2: Background service and tunnel

Verdict: **Approve** for installation and tunnel operation. This is the
implementing agent's self-review, with no separate reviewer approval.

## Reviewed state

Base: `fecdb692bef3c638c67c8ed1bfb7e945d696016e`.
The staged diff for `package.json`, `scripts/settings.mjs`,
`scripts/service.mjs`, and `scripts/terminal.mjs` has SHA-256
`424f8d90fb44e75e241c92b0ffc266e731c842e3b1dc3473a2f92fb8131046f6`.
Every changed source line was inspected, along with the generated launchd
property list and the running process tree.

## Invariants and counterexamples

- One launchd job owns one persistent local server and one tunnel process.
  The running job had exactly those two direct children after restoration.
- A repeated `start` preserves the active job and its address. The command
  observed the already running service and completed without reloading it.
- Local configuration survives stop/start. Installation creates it only when
  absent; the restored job read the same configuration.
- The endpoint is written outside Git, as one complete replacement of the
  status file. Neither repository files nor command arguments contain it.
- An assigned hostname is distinct from a reachable tunnel. During validation,
  the first restored tunnel exceeded the original 60-second readiness wait;
  later requests returned HTTP 200 and passed terminal verification. Startup
  now allows 120 seconds and preserves the last request failure in its error.
- HTTP shutdown closes the upstream; an upstream or tunnel failure ends the
  job so launchd can restart it. The signal and failure paths were inspected.

No actionable findings remain in the reviewed source.

## Mechanical and live evidence

- `npm run check`: passed for all six JavaScript source/test files.
- `npm run terminal -- install`: created and loaded the user LaunchAgent.
- `npm run terminal -- stop`: removed the running job while retaining files.
- `npm run terminal -- start`: restored the job. A later repeat confirmed both
  local and public readiness.
- `npm run terminal -- verify --local`: passed.
- `npm run terminal -- verify`: passed through the public Quick Tunnel, before
  and after restoration. It found 25 tools, executed a fresh command, preserved
  a process across calls, and handled concurrent identical request IDs.
- `plutil -lint` on the installed property list: passed.
- `launchctl print`: job running, with no exit recorded for the restored job.
- `git diff --cached --check`: passed.

## Exclusions and remaining work

Login restart is configured but a disruptive logout/reboot was not performed.
Mac sleep recovery and termination of arbitrary grandchildren during a forced
kill were not tested. Quick Tunnel hostname changes require updating the
connector after a whole-job restart.

The shared account shows Local Mac Terminal as connected, and the plugin
permissions API confirms **Allow all actions**. The current ChatGPTMOD chat
has not yet loaded its tools. A model-originated call through that connector
remains a separate acceptance check.
