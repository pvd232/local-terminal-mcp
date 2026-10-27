# Verification record

Date: October 27, 2026. Target client: ChatGPTMOD on macOS.

## Observed

- Node 22.23.4 and cloudflared 2026.10.0 were installed on the Mac.
- The real subprocess integration test passed under Node 22.23.4.
- A clean `npm ci` from the committed manifest and lockfile completed in a
  separate directory, preserving the running service's installed dependencies.
- The LaunchAgent property list passed `plutil -lint` and its job is running.
- The service has one Desktop Commander child and one cloudflared child.
- Direct loopback verification passed.
- Verification through the public Quick Tunnel passed, including after the
  background job was stopped and restored.
- The tunnel exposed 25 tools. A fresh shell command returned its nonce;
  `cat` accepted input from a later tool call; concurrent identical request IDs
  completed independently.
- The shared ChatGPT account shows **Local Mac Terminal** as connected.
- The permissions API confirms **Allow all actions** for that connector only.
- Additional paid-service cost: $0. Calls used the local server directly.

## Pending

The current turn's tool catalog exposes Remote Desktop Commander. A
model-originated call selected through **Local Mac Terminal** remains pending.
The service/tunnel HTTP checks cover transport; the final client check must
observe a call selected through the connector in ChatGPTMOD.

Direct UI automation of ChatGPTMOD was refused by the computer-use tool.
Registration was therefore completed through the shared account settings.

## Limits of the evidence

The LaunchAgent is configured to run at login. Logout/reboot, Mac sleep
recovery, and forced termination with arbitrary running grandchildren remain
unverified. Whole-job restarts change the public hostname
and require the connector address to be updated.

The public repository excludes the live endpoint, local history, and machine
configuration. The local startup logs retain the original readiness timeout
and the later successful connection checks.
