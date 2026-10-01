---
name: Native appearance override lifecycle
description: Why native theme reset behavior must follow the installed React Native contract.
---

Treat the installed React Native appearance contract as authoritative, rather than copying nullable reset examples from older SDKs.

**Why:** React Native 0.86 changed the reset contract used by older examples. In-app color tokens alone also do not determine the appearance of native controls such as keyboards and liquid-glass navigation.

**How to apply:** Tie native appearance overrides to the explicitly selected app mode, verify the installed SDK's system-mode restoration semantics, and keep loading/error screens visible independently of navigation mounting.