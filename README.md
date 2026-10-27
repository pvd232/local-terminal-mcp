# Local terminal MCP

Connect ChatGPTMOD to the free local Desktop Commander MCP server on a Mac.
ChatGPTMOD calls a personal custom MCP connector; Cloudflare forwards the
request to this Mac; the bridge passes it to one persistent Desktop Commander
process. Terminal sessions survive separate tool calls.

The setup's additional service subscription cost is $0. Desktop Commander's
[local server is free of monthly tool-call quotas](https://desktopcommander.app/pricing/).
The bridge calls the local server directly. Your existing
ChatGPT plan's usage limits still apply.

The implementation is currently on `setup/local-server-and-tunnel`, in
[PR #1](https://github.com/pvd232/local-terminal-mcp/pull/1).

## Install on a Mac

Use a Mac with Homebrew and nvm installed. Then:

```sh
git clone --branch setup/local-server-and-tunnel https://github.com/pvd232/local-terminal-mcp.git
cd local-terminal-mcp
nvm install
nvm use
npm ci
brew install cloudflared
npm run check
npm test
npm run terminal -- install
npm run terminal -- verify
```

`install` creates a user LaunchAgent, starts it, and waits up to two minutes for
the local bridge and public tunnel to answer. The job continues when ChatGPTMOD
closes. Launchd is configured to restart it at login and after a process failure.
The job runs with the current macOS user's permissions.

Installation preserves existing configuration. The LaunchAgent records the
absolute Node executable and checkout path. Keep that checkout in place; after
moving it or changing Node installations, stop the job and run `install` again
from its new location.

Versions used for the initial installation:

| Component | Version |
| --- | --- |
| Node | 22.23.4, declared in [.nvmrc](.nvmrc) |
| Desktop Commander | 0.3.1 |
| MCP Proxy | 6.7.21 |
| MCP client and server packages | 2.4.0 |
| cloudflared | 2026.10.0, installed through Homebrew |

JavaScript dependencies are pinned in [package.json](package.json) and
[package-lock.json](package-lock.json). Homebrew manages cloudflared separately.

## Connect the account used by ChatGPTMOD

1. Run `npm run terminal -- url` and copy the complete address.
2. Open [the shared ChatGPT plugin settings](https://chatgpt.com/plugins) in the
   same account used by ChatGPTMOD. Choose **Add custom MCP server**.
3. Name it **Local Mac Terminal**, choose **Server URL**, and paste the address.
4. Choose **No authentication**, acknowledge the custom-server notice, create <!-- direct-prose: allow -->
   the plugin, and connect it to the account.
5. Set this connector's permission to **Allow all actions**, if that is the
   access policy you want. The initial user requested this setting.
6. Return to ChatGPTMOD and select **Local Mac Terminal** with `@` in the chat.
   Ask it to run a command and inspect the selected tool's result.

Registration uses the account settings; everyday use is through ChatGPTMOD.
The [official custom-server guide](https://developers.openai.com/api/docs/guides/custom-mcp-server)
describes the shared registration flow. ChatGPTMOD is a custom desktop app;
its tool-refresh behavior must be verified in the app.

The complete address includes a randomly generated path. Treat it as the
connection credential and keep it out of public issues and repository files.
The connection uses the local server and the Quick Tunnel directly.

### macOS access to protected folders

The account's **Allow all actions** setting permits connector calls. macOS
separately controls the background process's access to protected folders.
Apple describes these permissions in its
[Privacy & Security guide](https://support.apple.com/guide/mac-help/change-privacy-security-settings-on-mac-mchl211c911f/mac).
During the initial installation, a Documents read stalled and the macOS privacy
log reported that the LaunchAgent's Node executable lacked Full Disk Access.
Commands and file reads in the development checkout passed.

For access to protected folders, open **System Settings → Privacy & Security →
Full Disk Access**. Add the absolute Node executable printed by
`node -p process.execPath` after `nvm use`, then enable its switch. Authenticate
through macOS if prompted. Keep this permission tied to the executable recorded
in the LaunchAgent; changing Node installations requires checking it again.
The installation's current permission status is in
[verification.md](docs/verification.md).

## Operate it

Run these commands from this checkout after `nvm use`:

| Command | Result |
| --- | --- |
| `npm run terminal -- status` | Check the bridge and whether a tunnel address has been assigned |
| `npm run terminal -- url` | Print the complete current connector address |
| `npm run terminal -- verify` | Test real terminal calls through the public tunnel |
| `npm run terminal -- verify --local` | Run the same test directly on the Mac |
| `npm run terminal -- start` | Load the job if needed and wait for readiness; preserve an active job |
| `npm run terminal -- stop` | Stop the current job and retain configuration and logs |
| `npm run terminal -- install` | Create or regenerate the LaunchAgent and start it |

Stopping the job ends current access. Its property list remains installed, so
it is configured to start again at the next login. A whole-job restart creates
a new Quick Tunnel hostname: copy the new address and update the custom
connector in the account settings before using it again.

Keep the Mac awake and connected while making remote calls. Quick Tunnels
[provide temporary hostnames with best-effort availability](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

If a call fails, run `status`, then `verify --local`, then `verify`. This
separates a local-server failure from a tunnel failure. Read `service.err.log`
for the exact startup or connection error before restarting the job.

## Local files

Machine state is stored in `~/Library/Application Support/local-terminal-mcp/`:

| File | Meaning |
| --- | --- |
| `config.json` | Persistent loopback port, private MCP path, and cloudflared executable |
| `current.json` | Derived process ID, start time, status, and current public address |
| `service.log` | Background job's ordinary output |
| `service.err.log` | Startup errors and cloudflared connection logs |

The generated LaunchAgent is
`~/Library/LaunchAgents/com.pvd232.local-terminal-mcp.plist`.
Desktop Commander also uses its existing local configuration and tool history;
this installer preserves them.

The live endpoint and machine credentials stay in local state files.

## Implementation and checks

- [bridge.mjs](scripts/bridge.mjs) launches one upstream server and forwards
  tool calls with MCP Proxy. JSON mode makes the replies compatible with
  [Quick Tunnels' request/response path](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/#limitations).
- [service.mjs](scripts/service.mjs) owns the bridge and tunnel lifecycle.
- [terminal.mjs](scripts/terminal.mjs) installs and operates the LaunchAgent.
- [settings.mjs](scripts/settings.mjs) owns local configuration and status files.
- [verify.mjs](scripts/verify.mjs) tests command execution, session persistence,
  and concurrent requests through the selected address.
- [bridge.test.mjs](tests/bridge.test.mjs) adds malformed-input recovery,
  unknown-path rejection, and repeated-close checks against a real subprocess.

`verify` checks for the required terminal tools and found 25 tools on the
initially installed version. It sends a fresh nonce through a shell command,
starts `cat`, sends input in a later tool call,
and terminates that test process. It checks that replies use JSON. Its output
reports observed success and omits the private endpoint.

An actual connector call can return a process ID while its command is still
running. Use `read_process_output` with that ID to retrieve later output.
Use `interact_with_process` to send input to an interactive session and
`force_terminate` to end it.

These HTTP checks verify the service and tunnel. A successful call selected
through **Local Mac Terminal in ChatGPTMOD** is a separate acceptance check.
Current evidence is in [verification.md](docs/verification.md).

The implementing agent records completed code reviews for each checkpoint:
[JSON bridge](docs/reviews/01-json-bridge.md) and
[background service](docs/reviews/02-background-service.md).
Those records identify the reviewed source and executed checks. Each record is
the implementing agent's self-review.
The [operating-guide review](docs/reviews/03-reproduction-and-handoff.md) records
reproduction checks; the [client-verification review](docs/reviews/04-client-verification.md)
records the later ChatGPTMOD calls and remaining macOS permission step.
