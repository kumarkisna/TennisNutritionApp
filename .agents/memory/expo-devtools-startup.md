---
name: Expo startup readiness
description: Distinguishing optional debugger errors and transient blank first frames from application failures.
---

Confirm Metro bundling and the app preview before treating a desktop React Native DevTools installation error as an application failure.

**Why:** This container's optional desktop debugger can report a missing libglib shared library while Metro still starts, bundles the app, and serves the preview normally.

**How to apply:** When the bundle and preview work, do not repeatedly restart the workflow or change application dependencies to fix the optional debugger. Investigate that component separately only if the debugger itself is needed or the app also fails.

An initial blank Expo preview frame is not proof of a port or rendering failure. Require meaningful visible app content after startup.

**Why:** Initial bundling and font readiness can outlast the preview capture's short wait. Healthy planner screens have appeared after a briefly blank reload without application errors.

**How to apply:** Distinguish startup readiness from persistent failure using rendered controls and browser/workflow evidence before restarting services or changing dependencies.

When tunnel mode is needed, keep `EXPO_TUNNEL_SUBDOMAIN` short enough to stay within DNS label limits while preserving Replit's managed Expo sign-in step.

**Why:** The generated tunnel hostname can exceed the DNS 63-character label limit in this workspace; a short workspace-derived label made the QR host resolvable.

**How to apply:** Verify the tunnel status endpoint and Android bundle request, then check the app at the Expo root route. A web-only `/web/` path is not the same route as Expo Go.

An Expo workflow restart can leave an older child process holding the injected app port; a new process may then wait at a prompt to switch ports.

**Why:** In this workspace, the first process survived the workflow restart and caused a blank preview even though its HTTP route still answered.

**How to apply:** If restart logs report the port is already in use, inspect the exact Expo process tree and port owner, stop only the stale app process, then restart on the configured port.

An Ngrok tunnel-start failure can be transient even when the app bundles correctly; a later managed workflow start may recover without application-code changes.

**Why:** This workspace showed repeated `failed to start tunnel` errors while a standalone web export succeeded, then connected on a later managed start. The optional React Native DevTools library warning remained but did not prevent the app from rendering.

**How to apply:** Separate Metro/bundle errors from tunnel errors, confirm the artifact status and rendered screen, and avoid changing Expo dependencies to address an external tunnel failure.