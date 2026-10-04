---
name: Mobile test runner
description: Keep the working directory correct when running the Expo artifact's standalone TypeScript regression suites.
---

Run the mobile regression suite with the current working directory set to `artifacts/clear-access-mobile`. The TypeScript runner is available through the shared scripts package, while some regression checks locate sources with `process.cwd()`. Resolve the runner path before changing directories; pnpm may return it relative to the scripts package.

**Why:** Starting the tests through the scripts package changes their working directory; source-path checks can then fail even when the app code is correct. Its executable path can also be relative, so resolving it after changing directories makes the runner appear missing.

**How to apply:** Resolve the shared `tsx` executable to an absolute path, then `cd` into the mobile artifact and run its `--test` files.