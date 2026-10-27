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
- This ChatGPTMOD chat loaded all 25 Local Mac Terminal tools and called the
  connector's `start_process`, `read_process_output`, `interact_with_process`,
  and `force_terminate` tools.
- A connector command returned `LOCAL_MAC_TERMINAL_CONNECTED`, `Darwin`, and
  the local username, then completed with exit code 0.
- A separate connector call read a fresh challenge file in the development
  checkout. Its contents matched the independently recorded SHA-256
  `99c62d191b391cbc1be2771f0ce24f1cc3acc3d7390131cc598870ee40dfec23`.
- An interactive `cat` session echoed input sent through a later connector
  call. The test session was then terminated.
- The user enabled Full Disk Access for Node 22.23.4 after authenticating in
  macOS. A later call through Local Mac Terminal in ChatGPTMOD read the original
  challenge file under Documents and finished successfully. Its contents
  matched the same independently recorded SHA-256.
- The service remained running under the same process ID during the permission
  change. Its bridge reports ready and its tunnel address remains assigned.
- Additional paid-service cost: $0. Calls used the local server directly.

## Client verification

Commands, file reads in the development checkout and Documents, and a
session spanning separate calls passed through the installed connector.
The earlier Documents read stalled while the macOS privacy log reported denied
`SystemPolicyAllFiles` access for the background Node executable. The read
succeeded after the user enabled that executable in Full Disk Access.

Direct UI automation of ChatGPTMOD was refused by the computer-use tool.
Registration was therefore completed through the shared account settings.
The final successful model-originated calls used Local Mac Terminal in this
running ChatGPTMOD chat.

## Limits of the evidence

The LaunchAgent is configured to run at login. Logout/reboot, Mac sleep
recovery, and forced termination with arbitrary running grandchildren remain
unverified. Whole-job restarts change the public hostname
and require the connector address to be updated.

The public repository excludes the live endpoint, local history, and machine
configuration. The local startup logs retain the original readiness timeout
and the later successful connection checks.
