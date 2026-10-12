---
name: Local meal alert policy
description: Consent, master-off safety, and native notification queue limits in the offline planner.
---

Meal alerts are optional, local, and date-specific. Preserve individual choices when the device-wide master switch is off. Request operating-system permission only after an explicit enable action, never during startup or backup restoration.

**Why:** The user requested optional alerts and a master override. Saved preferences are not evidence that a new device has notification permission, and automatic startup prompts would bypass the optional flow.

**How to apply:** Keep notification delivery separate from configuration. Browser previews may edit preferences but must never pretend to deliver background phone notifications.

Treat persisted alert preferences and the native pending-notification queue as separate resources.

**Why:** Operating-system jobs survive app shutdown; changing a stored boolean does not cancel them. Native cancellation and local persistence cannot share a transaction.

**How to apply:** Cancel owned pending meal jobs before acknowledging master-off, retain per-meal settings, and reconcile from committed preferences after failures. Reconcile on startup/resume and relevant edits, deletion or backup restoration. Preserve unrelated notification jobs.

Publish the committed local snapshot to the notification UI's query cache after a direct master-setting write.

**Why:** Invalidating the long-lived provider query alone left the mounted switch displaying the old flag despite successful device-storage writes. Only reload corrected it. Publishing the saved snapshot fixed immediate on/off feedback and passed the mounted-screen regression.

**How to apply:** Update the cache only after persistence succeeds; do not optimistically acknowledge master-off before native cancellation. Include no-reload switching and subsequent reload persistence in master-control checks.

Surface native scheduling limits and failures instead of claiming every future alert is scheduled.

**Why:** Devices limit pending local notifications, and permission, exact-alarm access, battery settings and Do Not Disturb can affect delivery.

**How to apply:** Clearly distinguish saved alerts from successfully scheduled ones, disclose overflow, refresh the queue when the app resumes, and verify actual delivery separately on physical iPhone/Android devices.

For Expo SDK 57 Android Expo Go, avoid importing the `expo-notifications` root barrel when the app only needs local notifications. Its push-token auto-registration side effect can invoke remote-push APIs, which Expo Go rejects.

**Why:** The app's local meal reminders triggered a remote-push error during module import, before any reminder action occurred.

**How to apply:** Import only the required local-notification modules directly, and recheck this behavior when upgrading Expo Notifications.

For Android local meal and hydration reminders, omit `channelId` and let Expo use its built-in fallback channel instead of manually creating a channel during permission checks.

**Why:** Samsung Android 12 rejected the custom channel call, while Expo's native notification presenter creates a fallback channel when a scheduled trigger has no channel ID.

**How to apply:** Keep permission reads free of channel setup and leave the trigger channel unset unless custom channel creation is verified on the target Android runtime.