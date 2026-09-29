---
name: Calendar dates in generated API validators
description: A generator mismatch for date-only planner values and how to avoid timezone and validation errors.
---

For calendar-only planner values, describe dates as patterned strings in OpenAPI and perform real calendar validation on the server. Keep date-only database values as strings.

**Why:** With this project's Orval/Zod generator, OpenAPI `format: date` generates `zod.date()` for query parameters (rejecting incoming URL strings) and `zod.coerce.date()` for bodies and responses (turning a day into an instant and potentially serializing an ISO timestamp). That is not a safe representation for a user's local planned day.

**How to apply:** When adding endpoints for day-based planning, keep the API date type a string such as `YYYY-MM-DD`, validate that it is a real date at the request boundary, and avoid converting the stored day to or from an instant.