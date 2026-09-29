---
name: Direct React server-render tests
description: JSX transform difference between standalone TypeScript test execution and Vite.
---

When rendering existing React components directly in standalone Node-based tests, allow for the test runner's JSX transform to differ from Vite's.

**Why:** The standalone TSX runner used a classic JSX transform even when supplied the web tsconfig; a component that worked in Vite threw `React is not defined` in its server-render test.

**How to apply:** For direct component imports in such tests, explicitly import React in the tested component or configure a test transform that reliably uses the automatic JSX runtime. Confirm by running the test rather than assuming Vite's transform applies.