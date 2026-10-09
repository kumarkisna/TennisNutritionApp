---
name: Tennis merge import identity
description: Stable local provenance and backup compatibility for cross-person tennis-food timetable merges.
---

Track each imported source slot with the source person's stable backup ID, source date, and source slot ID. Keep these references on the destination day, separately from meal portions.

**Why:** Local numeric person IDs can be remapped during backup restore, and users can unlink or delete timetable slots after merging. Content fingerprints alone cannot reliably prevent a second import.

**How to apply:** Treat the provenance references as the idempotency record for future tennis-food import or undo work. Strictly validate them in local storage and backup files, while continuing to accept older files that do not contain this optional metadata.
