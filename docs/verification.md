# Verification record

Date: October 27, 2026. Target client: ChatGPTMOD on macOS.

## Initial installation

- Node 22.23.4 and cloudflared 2026.10.0 were installed on the Mac.
- The real subprocess integration test passed under Node 22.23.4.
- A clean `npm ci` from the committed manifest and lockfile completed in a
  separate directory, preserving the running service's installed dependencies.
- The LaunchAgent property list passed `plutil -lint` and its job is running.
- The initial service had one Desktop Commander child and one cloudflared child.
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
unverified. The original Quick Tunnel route assigns a new hostname on whole-job
restart. The ngrok route retains the configured hostname and private MCP path.

The public repository excludes the live endpoint, local history, and machine
configuration. The local startup logs retain the original readiness timeout
and the later successful connection checks.

## Stable tunnel migration

The existing ngrok account's dashboard confirmed the **Free** plan and an
assigned development hostname. The ngrok agent was upgraded through Homebrew to
3.39.13; its locally saved account configuration passed `ngrok config check`.
The background job now runs ngrok with the assigned hostname. Additional
paid-service cost remains $0, subject to ngrok's
[Free limits](https://ngrok.com/docs/pricing-limits/free-plan-limits) of 20,000
HTTP requests and 1 GB of outgoing transfer per month.

The complete connector address matched byte for byte across service processes
17569, 18002, 18200, and 18309. Public verification passed for each process:
25 tools, a fresh shell command, a session spanning calls, and concurrent
request IDs. The final two restarts used immediate CLI `stop` and `start`
commands. Each stop returned after launchd removed the job, and each start
loaded a new process and passed public health checks.

The first immediate restart exposed launchd's asynchronous removal of the old
job. The CLI now waits for removal before completing `stop`. A separate
long-lived verification process also encountered a closed pooled HTTP
connection after restart. The retained passing checks use the shipped `verify`
CLI in a fresh process for each service instance.

The shared account now has a replacement **Local Mac Terminal** connector with
the fixed address and **Allow all actions**. The original connection is named
**Local Mac Terminal (Quick Tunnel)**. The replacement's refreshed catalog
shows 12 write tools and 13 read tools.

After the chat refreshed its tool list, model-originated calls through the
replacement connector passed in ChatGPTMOD. A command returned a fresh marker,
`Darwin`, and the local username. A protected Documents read returned the
original 70-byte challenge; Node hashing and a standalone `shasum` call matched
SHA-256 `99c62d191b391cbc1be2771f0ce24f1cc3acc3d7390131cc598870ee40dfec23`.
An interactive `cat` session accepted input in a later call, and a separate
`read_process_output` call returned that marker. Both test sessions were
terminated. The installed service remained process 18309 and its complete
connector address still matched the restart receipt.

The local `stable-chatgptmod-verification.json` receipt retains the actual
connector responses, including an initial combined-command hash mismatch and
the successful content read and hash rechecks. The setup and final client checks
are complete; login and sleep recovery retain the limits described above.
