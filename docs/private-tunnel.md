# Private Mac connection

ChatGPT sends a tool request to the selected private tunnel. OpenAI's tunnel
service passes it over the Mac's outbound HTTPS connection to `tunnel-client`.
That client forwards the request to the existing loopback HTTP bridge, which
owns one persistent Desktop Commander process. Routine requests use this route
directly. The existing VM-to-Mac SSH relay remains available for repairs.

The Mac exposes neither a public tunnel hostname nor a listening network port.
The bridge and native readiness listener bind to `127.0.0.1`. Tunnel access
belongs to the configured OpenAI workspace.

## Prepare and qualify

Use the Node version in [.nvmrc](../.nvmrc), then `npm ci`. Preserve an existing
installation's bridge port and private MCP path.

1. Create a named tunnel in the account and workspace used by ChatGPT.
2. Install the official [tunnel client](https://github.com/openai/tunnel-client/releases).
   Verify the release digest for the Mac architecture.
3. Create a restricted runtime API key with **Tunnels Read and Use** only.
   Store it outside Git in an owner-only file. Enter the secret locally.
4. Generate a native profile with `tunnel-client init --sample
   sample_mcp_remote_no_auth`. Supply the tunnel ID, the existing bridge's
   loopback MCP URL, a `file:/absolute/path` runtime-key reference, and a fixed
   loopback health listener such as `127.0.0.1:8932`. Keep the YAML outside Git.
5. Run `tunnel-client doctor --config /absolute/profile.yaml --json`.
   Qualification can use a temporary `runtimes connect` alias against the
   existing bridge while the old transport remains active.
6. In [ChatGPT Plugins](https://chatgpt.com/plugins), add a custom MCP server.
   Choose **Tunnel**, enter the tunnel ID, and choose **No authentication** at <!-- direct-prose: allow -->
   the MCP layer. The private tunnel controls access. <!-- direct-prose: allow --> Install the plugin and
   preserve **Allow low-risk** as the default tool permission.
7. Select that plugin in a chat and execute a benign Mac identity command.
   A local readiness response alone establishes only local readiness.

Installation-specific IDs, paths, keys, and operational receipts belong in the
machine state directory, outside the repository.

## Activate

Before restarting the bridge, inspect active terminal sessions and finish or
preserve their work. Back up the machine configuration. Stop the temporary
native runtime alias before starting the production client for the same tunnel.

```sh
npm run terminal -- secure <tunnel-id> /absolute/tunnel-client /absolute/profile.yaml
npm run terminal -- stop
npm run terminal -- start
npm run terminal -- status
npm run terminal -- verify --local
```

The activation command checks the profile's tunnel identity, bridge URL,
loopback health listener, and secret reference before saving it. Native
`doctor` must also succeed. Launchd owns the existing Node supervisor; that
supervisor runs `tunnel-client run --config ...` in the foreground as its child.
Use this one supervisor for production. Stop any qualification alias first.

Repeat a selected-plugin tool call after activation. Confirm terminal session
persistence across a transport-only restart before retiring the old public
route. Preserve its configuration for rollback. A whole-service restart ends
the Desktop Commander sessions it owns.

## Health, recovery, and remote work

The supervisor probes the actual Desktop Commander subprocess and native
`/readyz` each minute. The status command makes fresh probes. A native status
has `publicReady: null`; it reports private transport readiness separately.

A failed native child restarts with bounded backoff. Repeated failed readiness
checks trigger a transport-only restart after the startup grace period. Healthy
Desktop Commander sessions retain their owner. Three consecutive local bridge
failures restart the whole service. The native client handles its outbound
connection retries; Mac-wide DNS settings remain unchanged.

Request a bounded idle-sleep lease for remote work:

```sh
npm run terminal -- remote-work 120
npm run terminal -- remote-work off
```

The lease expires automatically. It prevents idle sleep while active; closing
the lid, forced sleep, loss of power, and loss of network can still interrupt
access. Ongoing health checks belong to the service. A chat heartbeat should
observe a durable task and notify only when action is needed. The Mac service and its
wake lease maintain access during remote work.

The native transport's documented request deadline is 120 seconds and its
envelope limit is 10 MiB. Start long commands with a short tool timeout, retain
the returned process ID, and poll with `read_process_output`. Transfer large
files in bounded chunks.

For a failure, inspect `status`, run `verify --local`, and test the selected
plugin. Repair through the existing authenticated VM SSH relay when the direct
route is unavailable. The relay has a separate outbound connection and remains
useful redundancy.

## References

- [OpenAI Secure MCP Tunnels](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
- [Native client onboarding](https://github.com/openai/tunnel-client/blob/master/docs/onboarding.md)
- [Service implementation](../scripts/service.mjs)
- [Connection reliability](reliability.md)
