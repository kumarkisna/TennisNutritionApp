---
name: Mobile test runner
description: Keep the working directory correct when running the Expo artifact's standalone TypeScript regression suites.
---

Run the mobile regression suite with the current working directory set to `artifacts/clear-access-mobile`. The TypeScript runner is available through the shared scripts package, while some regression checks locate sources with `process.cwd()`.

**Why:** Starting the tests through the scripts package changes their working directory; source-path checks can then fail even when the app code is correct.

**How to apply:** Use the shared `tsx` executable, but `cd` into the mobile artifact before running its `--test` files.