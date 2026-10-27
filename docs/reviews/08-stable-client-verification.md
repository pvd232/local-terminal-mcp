# Review 8: Fixed-address calls in ChatGPTMOD

Verdict: **Approve** the completed stable-address installation and final client
verification. This is the implementing agent's acceptance review. Reviews 6
and 7 record the implementation reviews and launchd repair.

## Reviewed state and invariants

Implementation and documentation base:
`db919fc9a3e4f21ce86f29d649ac0cba4721d25a`.
The final README and verification diff, excluding this record, has SHA-256
`4b62ee5a32f5a476a081c0422baa1ce2fc96704a0b2ce8b93c3b5aafc848f246`.
The final changes update `README.md` and `docs/verification.md`; implementation
source and dependencies retain the reviewed bytes.

The service must retain its configured origin and private MCP path, and separate
connector calls must reach one Desktop Commander process. Reinspection of
`settings.mjs`, `service.mjs`, and `bridge.mjs` confirmed that the configured
origin becomes both ngrok's explicit URL argument and the saved connector
origin. The bridge creates its upstream client and subprocess once, then reuses
that client for downstream calls. Process inspection found service 18309,
Desktop Commander child 18310, and ngrok child 18312.

The refreshed chat exposes the replacement connector under the canonical
Local Mac Terminal tool prefix. The earlier Quick Tunnel connector now has a
separate qualified prefix. Final calls selected the replacement tools, and the
service's complete endpoint digest still matched the restart receipt.

## Client observations

- A model-originated command returned its fresh marker, `Darwin`, and the local
  username through Local Mac Terminal in ChatGPTMOD.
- A later command read the original 70-byte challenge file under Documents.
  Node hashing and a standalone `shasum` call both matched the independently
  retained SHA-256
  `99c62d191b391cbc1be2771f0ce24f1cc3acc3d7390131cc598870ee40dfec23`.
- A `cat` session accepted input from another call. A separate
  `read_process_output` call returned the fresh session marker. Termination was
  requested for both test sessions, and process inspection confirmed both PIDs
  had exited.

The first combined command returned an empty-file digest from `shasum`.
Subsequent content reads and both hash rechecks passed. The first session input
returned an incomplete response; the completed session check used an explicit
output read. The local `stable-chatgptmod-verification.json` retains these
responses, including the initial observations. The first hash mismatch's cause
remains unestablished.

Remaining actionable findings in the inspected source: 0. Model-originated
command, protected-file, and persistent-session acceptance checks passed. The
earlier public receipt records the identical complete URL across three service
restarts and successful MCP checks for four service instances.

## Validation boundary

The final revision changes prose and links. The prose checker, all 26 local
artifact and repository links, and `git diff --check` passed. The source checks
and four passing tests at the base commit
remain applicable because their inputs retain identical bytes. The new native
connector calls supply the previously pending client evidence.

The ngrok account remains on Free with its documented request and transfer
limits. Logout/reboot and Mac sleep recovery remain unverified. GitHub review
and integration status are reported separately from the installed service.
