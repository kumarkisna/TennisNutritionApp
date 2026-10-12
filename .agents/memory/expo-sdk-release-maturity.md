---
name: Expo SDK patch release maturity gate
description: Handling Expo diagnostics when matching patch releases are blocked by the workspace package registry's release-age policy.
---

When Expo recommends SDK-compatible patch releases that the workspace registry considers too new, keep the current locked versions rather than bypassing the release-age gate.

**Why:** `expo install --fix` can fail because the required patch versions were published within the registry's minimum maturity window; this is separate from the app's runtime bug.

**How to apply:** Preserve the existing dependency files, finish debugging independently when possible, and retry Expo's normal alignment checks after the packages have aged past the gate.
