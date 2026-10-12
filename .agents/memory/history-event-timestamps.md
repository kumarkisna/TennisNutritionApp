---
name: History event timestamps
description: Ordering change histories when concurrent edits wait on row locks.
---

Timestamp change-history events when the event is inserted, after acquiring the person row lock, rather than at transaction start.

**Why:** PostgreSQL's transaction-start time can predate an intervening committed edit while a transaction waits for a lock. Sorting those timestamps can misorder the actual before-and-after sequence.

**How to apply:** For histories recorded with serialized edits, use insertion-time wall-clock timestamps and a stable tie-breaker. Keep transaction-start timestamps for unrelated data where they are appropriate.
