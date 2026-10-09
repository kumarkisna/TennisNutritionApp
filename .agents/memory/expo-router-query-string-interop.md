---
name: Expo Router query-string interop
description: Compatibility rule for Expo Router navigation with the workspace query-string security override.
---

Keep the workspace's `query-string` 9.x security override and bridge Expo Router's named `parse`/`stringify` expectations through a Metro-scoped interop shim.

**Why:** Expo Router 57 uses named methods through a namespace import, while query-string 9 exposes a default API object under Metro's module interop. Navigation can fail at runtime even when the app bundles successfully; downgrading would weaken the workspace security override.

**How to apply:** When Expo Router navigation reports that `queryString.stringify` or `queryString.parse` is missing, verify the Metro alias is limited to Expo Router modules and the shim re-exports the methods from the v9 default object.
