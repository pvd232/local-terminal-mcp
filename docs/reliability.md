# Keep the local connection available

Use the installed **Local Mac Terminal** plugin with the configured ngrok
hostname. **Local Mac Terminal (Quick Tunnel)** is the older connection and
points to an expired Cloudflare address. Its app definition is retained.
Keep the complete MCP URL private.

## Check the connection

From this checkout after `nvm use`, run:

```sh
npm run terminal -- status
```

The command checks both the loopback bridge and the public address. It reports
`bridgeReady`, `publicReady`, and their check time; an unhealthy result exits
with status 1. The supervisor also records its last checks, last successful
public response, classified error, tunnel restart count, and active wake lease
in the machine-local `current.json`. Readiness requires a response from the service at that address.

Each readiness request includes a random probe value. The bridge echoes that
value only after the Desktop Commander subprocess answers an MCP ping.
Responses disable caching. An incorrect route, ngrok error page, dead child,
or unanswered ping therefore fails readiness. Readiness proves the HTTP route
and subprocess protocol response; the explicit `verify` operation also
runs a terminal command and checks a persistent session.

## Heartbeats and recovery

The supervisor checks local readiness once per minute, with one check in flight
at a time. Three consecutive local failures restart the service through launchd.
A Desktop Commander subprocess exit also restarts the service.

Public readiness runs at startup and every ten healthy minutes. This costs
about 4,320 requests in 30 days before user traffic, operator checks, restarts,
and retries. Failed public checks back off from one minute to ten minutes.
Native ngrok heartbeats maintain the transport separately; they are configured
at ten-second intervals with a fifteen-second failure tolerance.
[ngrok documents both settings](https://ngrok.com/docs/gateway/agent/config/v3).

After repeated public failures with a healthy local bridge, the supervisor restarts only the ngrok child after three failed public probes and
at least five minutes since that child started. A child that ignores termination
is killed after five seconds. Child exits retry after one second, backing off
to thirty seconds. Healthy terminal sessions retain their Desktop Commander
process during tunnel recovery. The fixed hostname and private MCP path stay
the same. Quick Tunnels retain their temporary-address behavior.

Name-resolution and network-unreachable errors leave recovery to the tunnel's
native reconnect loop while the supervisor waits.
HTTP authentication, billing, and rate-limit responses also suppress tunnel
restarts; those conditions require network or account recovery.
A broken public route may take up to ten minutes to be detected during healthy
operation, followed by the retry intervals. Continuous access also requires an awake and connected Mac.

## DNS interruptions

This Mac's ngrok agent uses `1.1.1.1` and `8.8.8.8` for tunnel-session DNS
resolution. The health checker first tries the system resolver, then uses the
same fallback resolvers after a failure or a 1.5-second wait.
The change leaves Wi-Fi, campus DNS, and other applications' settings intact.
The original private ngrok configuration was backed up beside `ngrok.yml`
before modification. Authentication and TLS verification retain their settings.

Both fallback resolvers must be reachable on the active network. A captive
portal, disconnected network, or forced sleep can still interrupt access.
[ngrok's DNS option](https://ngrok.com/docs/gateway/agent/config/v3) controls
tunnel-session lookup; other applications continue to use the Mac's configured network connection.

## Sleep during remote work

Request a timed remote-work session:

```sh
npm run terminal -- remote-work 120
npm run terminal -- status
```

This prevents idle system sleep for two hours. The default is 120 minutes;
the accepted range is 1–720 minutes. The service applies changes immediately
through its launchd job signal, or at its next heartbeat. Renew by running
the command again. End early with:

```sh
npm run terminal -- remote-work off
```

The service uses macOS `caffeinate -i` with both a timeout and the supervisor's
process ID. Expiry or service exit releases the assertion. It permits display
sleep and leaves the Mac's permanent power settings unchanged. Intentional sleep, a closed lid, or an exhausted battery can still suspend
the Mac.
Use AC power for extended sessions.

Only an explicit remote-work command renews the wake lease. Expiry restores
normal idle sleep while monitoring continues.

## Verification and restoration

After restarting the service, run `status` and `verify`, then compare the
machine-local endpoint with the installed plugin's saved address. Store the complete endpoint only in account settings and local state.

To undo the machine-local DNS and native heartbeat tuning, restore the private
`ngrok.yml.before-reliability-20261121` backup and restart the job.
End the wake lease with `remote-work off`. Repository changes are independently
revertible through Git.
