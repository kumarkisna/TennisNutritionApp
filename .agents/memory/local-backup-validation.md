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

Keep three transfer scopes distinct: Foods-tab files contain the food library only; person planner files contain one profile, its dated planner records, and foods referenced by its meals; whole-device backups remain available separately. Person imports create a new profile, remap local IDs, reuse exact-match foods, and never replace existing profiles or records.

**Why:** Food and planner IDs are local to each device, and person names may collide. Additive imports preserve meal-to-food links without risking another profile’s records.

**How to apply:** For transfer changes, test ID collisions, same-name profile suggestions, exact food reuse, and that unrelated profiles remain unchanged. Keep global reminder enablement on the destination device.

On Android, every export must offer saving to a chosen device folder as well as sharing to another app. A share sheet alone is not a local-save option.

**Why:** The user reported that share-only export forced them to use another app when they wanted a local copy.

**How to apply:** Write exports with Android's Storage Access Framework, keep sharing as a separate choice, and report cancellation without claiming the file was saved.