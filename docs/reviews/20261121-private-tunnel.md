# Private tunnel review — 2026-11-21

The implementing agent reviewed every changed source and test line against the
existing bridge, recovery policy, launchd owner, and machine configuration.
This is a self-review.

The change adds a private transport to the existing supervisor. The official
native client forwards requests to the same persistent HTTP bridge. Native
profiles must match the selected tunnel, local target, readiness listener,
and secret-reference policy before activation. Runtime keys and native profiles
remain outside Git.

The reviewer checked native child exit, repeated failed readiness, startup
grace, backoff, session ownership, bounded wake expiry, public-route rollback,
profile mismatches, and the distinction between local readiness and a real
selected-plugin call. A failed native readiness response is consumed before
classification. The supervisor restarts the transport while preserving the
bridge owner.

Executed against Node 22.23.4:

- The project's syntax check passed.
- All three focused Node test files passed: 12 tests, zero failures.
- Both isolated provider lifecycles preserved a terminal session across child
  restart and exercised wake expiry, renewal, and release.
- Native readiness accepted the vendor response and rejected an unready
  listener, public host, and response that exceeded its deadline.
- Profile checks rejected a mismatched tunnel, bridge target, health listener,
  and literal runtime secret.
- The authenticated official client doctor returned OK for the real candidate.
- A native qualification runtime connected alongside the old public route.
- A ChatGPT web chat selected the private plugin and returned the expected Mac
  hostname, user, and fresh command marker.

The current desktop chat's tool catalogue has a separate refresh boundary.
The web test establishes selected-plugin execution in ChatGPT web. Desktop
refresh and production cutover outcomes belong in the machine-local
operational receipt after activation.

The design retains the existing VM SSH recovery route. Vendor transport limits
require short start calls and later polling for long commands. Planned sleep,
network disconnection, and vendor outages remain availability limits.
