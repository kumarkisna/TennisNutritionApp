---
name: Wouter links in server-render tests
description: Static location hooks for direct Node SSR tests of React components containing Wouter links.
---

Use a Router with a simple static location hook when directly server-rendering a component containing Wouter Link in Node tests.

**Why:** The default browser location hook expects global location, while the installed Wouter memory-location hook uses useSyncExternalStore without the server snapshot React SSR requires. Neither works in a pure Node server render when the Link mounts.

**How to apply:** Wrap the tested component in Router with a hook returning a fixed pathname and no-op navigation. This is for static render assertions, not tests of actual navigation.