---
name: Browser barcode camera permission
description: Handle a browser-denied camera permission in the web barcode scanner.
---

Camera permission in a browser belongs to the user and the site origin. The app cannot programmatically reverse a saved denial or open protected browser settings. An embedded preview may also block camera access; the scanner should open in a standalone tab first.

**Why:** browsers gate camera access behind secure-origin and user-permission checks; app code cannot grant the user's site permission.

**How to apply:** distinguish an embedded-preview block from a standalone site's denied permission. For a denial, explain how to set Camera to Allow in the browser's site controls, reload the page, retry the scan, and retain manual food entry.
