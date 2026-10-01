---
name: Optional Expo desktop debugger startup
description: Distinguishing an optional desktop DevTools failure from a broken Metro server in this container.
---

Confirm Metro bundling and the app preview before treating a desktop React Native DevTools installation error as an application failure.

**Why:** This container's optional desktop debugger can report a missing libglib shared library while Metro still starts, bundles the app, and serves the preview normally.

**How to apply:** When the bundle and preview work, do not repeatedly restart the workflow or change application dependencies to fix the optional debugger. Investigate that component separately only if the debugger itself is needed or the app also fails.