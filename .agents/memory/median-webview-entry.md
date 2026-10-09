---
name: Median WebView entry route
description: Keep the standalone Median browser build's launch path separate from Expo Go's native start screen.
---

For the Median static web build, the `/web/` service URL should open directly to the Planner. Keep this web-only redirect in the production server; leave the shared Expo root on its Overview screen.

**Why:** Median is a browser build of the Expo app and shares its route tree, but the web wrapper has a direct-to-planner launch requirement that should not change Expo Go behavior.

**How to apply:** When changing the web build's base path or initial routes, test the `/web/` redirect and Planner route together, and verify the Expo Go service root still opens normally.
