---
name: Expo Go Android SDK 57 loading
description: Diagnose Android Expo Go download IOExceptions before app code starts.
---

On Android, Expo Go SDK 57 can fail to load a signed-in private project with `java.io.IOException: Failed to download remote update` because of a native client session-header defect. This occurs before the app's JavaScript, scanner, or permissions code runs.

**Why:** the fix belongs in the Expo Go native client, so changing application code or camera permissions cannot resolve the failed update download.

**How to apply:** first verify the project manifest and bundle are reachable from the Expo tunnel. If they are, confirm the device's Expo Go SDK; test browser behavior separately or use a matching Expo Go client after a supported SDK migration. Do not treat successful bundling as proof that the phone loaded the app.
