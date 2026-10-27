# Review 6: Stable-address implementation

Verdict: **Approve** for the reviewed code and documentation. Deployment,
restart equality, and the connector switch await ngrok account sign-in. This
is the implementing agent's completed self-review.

## Reviewed state

Base: `61d3743d49b69fe6425287963130d0f77d5a8455`.
The staged implementation and guide diff, excluding this review record, has
SHA-256 `02334e0410e7589c4b105b2c8c15ed29ec41a1bbc5a90e7395f525645012850f`.
Scope: `scripts/settings.mjs`, `scripts/service.mjs`, `scripts/terminal.mjs`,
`tests/settings.test.mjs`, the check command in `package.json`, `README.md`,
and `docs/stable-address.md`. The package lockfile and bridge source are
unchanged.

## Design and propagation

The required invariant is a fixed HTTPS origin plus the existing private MCP
path after a background-job restart. Existing persistent settings own that
choice; the service owns launching the selected tunnel. Reusing a Quick Tunnel
preserves the address-change problem. A named Cloudflare tunnel requires a
domain managed on Cloudflare; the user reported having none. Extending the
existing service with the free ngrok account hostname adds one provider choice
and preserves the bridge and launchd job. A relay service would introduce
another deployed component and a dynamic-origin registration protocol.

`parseSettings` resolves the original `cloudflaredPath` representation to the
Quick Tunnel provider. New writes use `tunnel` as the provider authority.
`ngrokOrigin` accepts assigned free HTTPS hostnames and rejects custom domains,
credentials, non-default ports, paths, queries, and fragments. The CLI retains
the local port and private MCP path while saving the selected provider.

The service passes the configured origin explicitly to ngrok. Startup still
requires a successful public health response. A saved origin can identify the
address before the ngrok connection is ready, so status assignment alone is
insufficient for acceptance. Existing upstream sessions continue to belong to
the single Desktop Commander child.

## Counterexamples and checks

- An old configuration remains readable; a new provider declaration takes
  precedence over its legacy field. A round trip retains the fixed origin and
  private MCP path.
- A paid custom domain or a URL containing extra routing information fails
  validation. Missing origins and unknown providers also fail.
- The current ngrok agent accepts the required `--url` option. The original
  agent rejected that option; Homebrew upgraded ngrok to 3.39.13. Its account
  authentication remains a deployment prerequisite.
- Node 22.23.4 passed `npm run check`, the three settings tests, and all four
  tests under `npm test`, including real subprocess forwarding and sessions.
- The existing running service still reports a ready bridge under its original
  process ID. Its active Quick Tunnel remains assigned.
- The prose checker, all 18 local links in the changed documentation, and
  `git diff --cached --check` passed.

Remaining actionable findings in the reviewed source: 0. The real ngrok
startup, repeated restart/address-equality checks, free-plan confirmation, and
ChatGPTMOD call through the updated connector remain pending. Those results
must be recorded before claiming the installed address is stable.
