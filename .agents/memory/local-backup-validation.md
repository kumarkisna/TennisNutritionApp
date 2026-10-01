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