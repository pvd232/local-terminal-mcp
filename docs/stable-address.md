# Keep the connector address stable

Use your ngrok account's assigned development hostname to retain the same
connector address across background-job restarts. The local bridge, private
MCP path, Desktop Commander process, and Node permissions keep their existing
roles. The tunnel provider changes from Cloudflare Quick Tunnels to ngrok.

## Cost and account requirements

Use an ngrok **Free** account and its assigned `*.ngrok-free.app` or
`*.ngrok-free.dev` hostname. A domain purchase is unnecessary. The hostname
remains assigned to the account across agent restarts.
[ngrok's Free plan](https://ngrok.com/docs/pricing-limits/free-plan-limits)
allows 20,000 HTTP requests and 1 GB of outgoing transfer per month. Each MCP
protocol request and public verification request counts toward those limits.
Your ChatGPT plan's usage limits also apply.

Keep the account on Free. This setup requests the assigned development hostname
and rejects custom-domain inputs. The default Cloudflare Quick Tunnel route
remains available for account-free installation.

## Configure once

1. Install a current ngrok agent with `brew install --cask ngrok`.
2. Sign in to the [ngrok dashboard](https://dashboard.ngrok.com/), confirm the
   Free plan, and copy the account's assigned development hostname.
3. Follow the dashboard's agent-authentication instructions to save the
   authtoken on this Mac. Keep that credential in ngrok's local configuration.
4. From this checkout after `nvm use`, run:

   ```sh
   npm run terminal -- stable assigned-name.ngrok-free.dev
   npm run terminal -- stop
   npm run terminal -- start
   npm run terminal -- verify
   npm run terminal -- url
   ```

5. Replace the account's temporary connection once. The settings page used for
   this installation offers name and description edits, tool refresh, and app
   deletion; its server URL is fixed. Rename the existing connector to
   **Local Mac Terminal (Quick Tunnel)**. In the plugin directory, choose
   **Add → Add custom MCP server**, name the replacement **Local Mac Terminal**,
   and paste the complete address printed by `url`. Choose
   **No authentication**, create the plugin, and connect it. <!-- direct-prose: allow -->
   Apply the desired action permission to the replacement connector. The
   existing private MCP path is preserved.
6. Stop and start the job again, then compare `url` with the saved address and
   run `verify` again. Both address equality and successful tool calls are
   required for the restart check.

The one-time switch from a Quick Tunnel changes the hostname. Later job
restarts retain the configured ngrok hostname and MCP path.

## Configuration and lifecycle

The local `config.json` stores `tunnel.provider`, `tunnel.executablePath`, and,
for ngrok, `tunnel.origin`. The ngrok authtoken stays in ngrok's own local
configuration. The repository excludes both configuration files.

`stable` validates the hostname and ngrok configuration, then saves the selected
provider. Stop and start the job to apply that selection. The stop command waits
for launchd to remove the old job before returning, so an immediate start loads
the replacement. Launchd continues to
supervise one bridge and one tunnel process. Public startup checks wait for the
actual endpoint to answer; a saved hostname alone leaves readiness unproven.

The previous file format with `cloudflaredPath` remains readable and resolves
to the Quick Tunnel provider. New writes use the `tunnel` object as the single
provider declaration.

## Scope of stability

The fixed hostname survives agent and background-job restarts while the ngrok
account and assigned hostname remain active. The Mac still needs to be awake
and connected. Changing accounts, changing the configured hostname, or replacing
the private MCP path changes the full connector address.

Final observations for this Mac belong in [verification.md](verification.md).
