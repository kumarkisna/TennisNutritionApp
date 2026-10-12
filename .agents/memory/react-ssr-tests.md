---
name: Direct React server-render tests
description: JSX transform difference between standalone TypeScript test execution and Vite.
---

When rendering existing React components directly in standalone Node-based tests, allow for the test runner's JSX transform to differ from Vite's.

**Why:** The standalone TSX runner used a classic JSX transform even when supplied the web tsconfig; a component that worked in Vite threw `React is not defined` in its server-render test.

**How to apply:** For direct component imports in such tests, explicitly import React in the tested component or configure a test transform that reliably uses the automatic JSX runtime. Confirm by running the test rather than assuming Vite's transform applies.

Standalone renders of shared workspace hooks must also share one React and React Query runtime with the renderer/provider.

**Why:** pnpm can install separate peer-resolved React Query copies. A standalone runner can load a different React dispatcher or QueryClient context than the component, producing invalid-hook-call or missing-provider errors despite Vite's deduplicated app working.

**How to apply:** Deduplicate React, React DOM, and React Query together in the SSR test transform. Deduplicating only React does not unify the QueryClient context.