---
name: Local backup validation boundary
description: Why imported backup validation is separate from legacy device-storage hydration.
---

Validate external backup files strictly, but do not automatically impose new import restrictions on existing device storage.

**Why:** A backup is an untrusted external input. Older installations may have records accepted under earlier validation rules; tightening ordinary hydration as part of backup work can lock users out of their only local records before they can recover them.

**How to apply:** When adding backup fields or versions, update import validation and round-trip tests together. If existing storage needs stricter rules, handle that through a deliberate, lossless migration rather than silently replacing or rejecting existing records.

Preserve finite historical food nutrition values even when they exceed the limits used to create or edit new foods. Validate an export against the restore contract before offering it as a file.

**Why:** Older imported mineral values may exceed current editing limits. Applying those limits to restore creates apparently successful backups that cannot be reopened. A backup must not silently correct the original nutritional data.

**How to apply:** Test legacy migration through export, preview, restore and reload, not just round trips of newly created records. Count current-device records directly from trusted storage so an unsupported export cannot prevent restoring a separately valid backup.

Keep three transfer scopes distinct: Foods-tab files contain the food library only; person planner files contain one profile, its dated planner records, and foods referenced by its meals; whole-device backups remain available separately. Preserve backup ID order: the first is the profile's original identity, and additional IDs appended by a same-name restore are imported links that can be removed or reassigned. Never move or unlink the first ID. Imports automatically match any linked ID; a first import can explicitly link a same-name profile. Unmatched people are added separately, while matched restores add missing records without replacing profile settings or existing records.

**Why:** Numeric planner IDs are device-local, and display names alone cannot prove identity. Stable backup IDs support repeat restores; explicit first-time linking avoids silently merging two people who happen to share a name. Keeping the original identity first distinguishes imported links without a schema migration, and editing links must not move existing planner data.

**How to apply:** Append new IDs during merges. Link management may mutate only IDs after the first, and should test stable-ID matching, first-time same-name linking, repeat-import deduplication, exact food reuse, legacy files without IDs, and that unrelated profiles remain unchanged. Keep global reminder enablement on the destination device.

On Android, every export must offer saving to a chosen device folder as well as sharing to another app. A share sheet alone is not a local-save option.

**Why:** The user reported that share-only export forced them to use another app when they wanted a local copy.

**How to apply:** Write exports with Android's Storage Access Framework, keep sharing as a separate choice, and report cancellation without claiming the file was saved.

Android imports should use the system document picker’s per-file access, copy the selected item to app cache, and read it through an Expo file API that supports document URIs. Do not request broad shared-storage permission.

**Why:** Android’s document picker grants access to the selected URI; broad storage access is unnecessary and is not a substitute for reading through a URI-compatible API.

**How to apply:** Keep the cache copy available through parsing, then remove only the temporary app-cache file. Confirm provider-specific behavior on a physical Android device.

Restore previews should estimate additions by applying the same additive merge logic to a deep clone of the destination state, rather than maintaining a separate prediction algorithm.

**Why:** Separate counting rules drift from actual restores, especially when an existing activity day is enriched instead of inserted. A misleading estimate can cause users to misunderstand what the backup will change.

**How to apply:** Resolve the same person destinations as the importer, simulate against a clone, report incoming/add/skip counts, and test that preview leaves persisted state unchanged and that predicted additions equal the eventual import result.