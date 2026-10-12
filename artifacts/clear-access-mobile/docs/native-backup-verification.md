# Native backup verification

## Current evidence boundary

Node regression tests cover application-side native I/O orchestration with
injected file, picker and sharing implementations, plus the actual local-store
restore/preview validation. They do **not** exercise an iPhone, Android device,
OS share sheet, file provider, native AsyncStorage, or airplane mode.

The user indicated the Android device checks are done, but provided no device
model, OS version, or individual pass/fail results. iPhone verification was
left out at the user's request. This Linux workspace has no connected devices,
Android emulator tooling, or iOS simulator. Do not infer individual Android
results or claim verification on iPhone solely from these tests.

Run automated checks from the workspace root:

```sh
scripts/node_modules/.bin/tsx --test artifacts/clear-access-mobile/lib/native-backup-file.test.ts artifacts/clear-access-mobile/lib/local-store.test.ts
pnpm --filter @workspace/clear-access-mobile run typecheck
```

## Cleanup and sharing constraints

- Expo Sharing resolves on Android activity return or iOS sheet dismissal.
  It exposes no reliable saved-versus-canceled result, nor a guarantee that an
  external recipient has completed a durable copy.
- Exports handed to the share sheet remain in OS-managed app cache; the app
  does not immediately delete them or use a fixed-delay deletion. The OS may
  evict cached files under storage pressure. This is not a permanent backup:
  users must complete a save to their chosen destination.
- A partial export that failed before sharing is cleaned up on a best-effort basis.
- Only the picker's copied `DocumentPicker` cache file is deleted, after reading.
  An unexpected original/provider URI is never deleted.
- Cleanup failure must not hide the original read/write failure or discard a
  successfully read preview. Cache may retain an unencrypted personal-data
  copy when cleanup fails or an export has been offered for sharing.

## Real-device checks still required

Use synthetic records on dedicated test installations, never a person's only
copy of their planner. Record device model, OS version, app/runtime version,
destination/provider, steps, result, and screenshots or a screen recording.
Use locally saved files for the offline cases; a cloud-only file may be
unavailable in airplane mode even though the local restore code is offline.

| Check | iPhone | Android | Expected result |
| --- | --- | --- | --- |
| Save/share to local storage | Not run at user's request | User indicated Android check done; details not provided | iOS: Save to Files → On My iPhone. Android: use an installed local save-capable destination. Reopen the JSON and verify all profiles, foods, meals, activities, goals/settings and height history. Not all Android share sheets offer a local save action. |
| Share cancellation | Not run at user's request | User indicated Android check done; details not provided | Cancel the sheet and, on iOS, a selected destination's follow-up dialog. UI becomes usable; existing records unchanged; no claim that a backup was saved. |
| Picker cancellation | Not run at user's request | User indicated Android check done; details not provided | Cancel, retry, then choose a file. No pending preview after cancellation and no records changed. |
| Preview cancellation | Not run at user's request | User indicated Android check done; details not provided | Preview incoming/current counts, cancel replacement, and reopen app. Original records remain. |
| Restore/relaunch offline | Not run at user's request | User indicated Android check done; details not provided | Save the file locally first; keep the app loaded, enable airplane mode, choose saved JSON, confirm replacement, close and reopen the app. Restored data and settings persist. A standalone installed build is preferable because Expo Go may need Metro to load its bundle. |
| Invalid/oversized file | Not run at user's request | User indicated Android check done; details not provided | Corrupt JSON, unrelated JSON and a >10 MB file produce an error, never alter records, and allow choosing another file. |
| Slow destination / late read | Not run at user's request | User indicated Android check done; details not provided | Save to a slow destination or recipient, return to planner, then complete destination copy. Saved JSON is intact and reopens; cache cleanup never deletes the original saved file. |
| Sharing unavailable/rejected | Not run at user's request | User indicated Android check done; details not provided | In a controlled native test harness disable sharing or force its native call to reject; verify recoverable error, unchanged records, and successful retry. |
| Export/picker storage failure | Not run at user's request | User indicated Android check done; details not provided | On disposable devices/harness, inject cache write or provider-copy/read failure. Records remain unchanged, UI recovers, retry succeeds once storage/provider is available. |
| Restore storage failure | Not run at user's request | User indicated Android check done; details not provided | Inject a native AsyncStorage write failure before committing a confirmed restore. Existing records survive both in-session and relaunch; valid backup remains retryable. |

The injected automated suite covers error/cancellation logic deterministically.
Controlled native failure tests are still necessary to check actual module
behavior. Do not fill a user's personal device or remove their records to
simulate low storage.