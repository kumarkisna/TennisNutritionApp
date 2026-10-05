---
name: Expo web printing
description: Keep generated printouts separate from the current Expo web app page.
---

In the installed Expo SDK 57 `expo-print` web implementation, both `printAsync({ html })` and `printToFileAsync({ html })` call `window.print()` on the current page and ignore the supplied HTML.

**Why:** Browser print preview showed the live app instead of the generated plan document.

**How to apply:** On web, open a print window synchronously during the user's click, write the generated HTML into it, and call that window's `print()`. Handle blocked pop-ups explicitly. On iOS and Android, use `Print.printAsync({ html })`.