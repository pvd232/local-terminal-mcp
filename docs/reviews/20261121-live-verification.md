# Live connection verification

Observed on November 21, 2026, after activating implementation commit
`e99e89e9c3a34718b7455c0de37f4bcc5656c831` on the established Mac.

## Account connection

The existing fixed-address **Local Mac Terminal** plugin is installed.
Its saved endpoint hashes to the same value as the active Mac endpoint.
The plugin settings tool refresh completed. The historical
**Local Mac Terminal (Quick Tunnel)** definition remains available under
its explicit old-route name.

The replacement retains its default **Allow low-risk** permission setting.
Its endpoint and authorization scope identify the existing Mac service.

## Service and recovery

The old bridge reported zero active terminal sessions before activation.
Launchd started the new supervisor, and the CLI reported both local and
public readiness. Public verification returned 25 tools and passed the
fresh-command, persistent-session, and concurrent-request checks.

A live recovery check opened a terminal session through the public endpoint,
verified the ngrok child's parent process, and terminated that owned child.
The supervisor started a replacement tunnel. The supervisor process,
public endpoint, and terminal session survived. The retained session accepted
fresh input through the recovered public route.

An independent request from Columbia then executed `hostname; id -un`
through the public endpoint and returned `Peters-MacBook-Air-9.local`
and `machina`.

At 18:23:33 UTC the supervisor's next heartbeat reported:

- `status: ready`
- `bridgeHealthy: true`
- `publicHealthy: true`
- `lastError: null`
- `tunnelRestarts: 1`

The private operational receipt is stored in the service's local state
directory as `reliability-verification-20261121.json`.

## DNS, transport heartbeats, and sleep

Both `1.1.1.1` and `8.8.8.8` resolved the ngrok connection hostname from this Mac
before activation. The ngrok configuration checker accepted those scoped
resolvers and the ten-second heartbeat with fifteen-second failure tolerance.
The recovered ngrok process uses that validated configuration. macOS Wi-Fi
DNS settings retain their DHCP configuration.

The two-hour remote-work request expires at 20:22:36 UTC
(3:22:36 p.m. Eastern). macOS reported the expected `caffeinate` assertion
on behalf of the supervisor for 7,200 seconds. Display-sleep and permanent
power settings retain their previous values. Heartbeat checks leave the
lease deadline unchanged.

Future DNS failures, captive portals, closed-lid sleep, and battery exhaustion
remain outside this observed run. The documented fallback and recovery
behavior improves recovery while preserving those availability limits.
