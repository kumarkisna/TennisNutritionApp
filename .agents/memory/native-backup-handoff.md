---
name: Native backup share handoff
description: Native sharing completion is not confirmation of destination persistence or cancellation.
---

Do not infer that a backup was saved, that a share was canceled, or that a
recipient is finished reading its URI merely because Expo Sharing resolves.
Do not manually delete an exposed export immediately after sheet dismissal.

**Why:** The installed Expo native implementation resolves on Android activity
return and iOS sheet dismissal without reporting destination persistence or
cancellation. A recipient can still be using the file after the app resumes.
Retaining exposed exports in OS-managed cache trades additional temporary
unencrypted copies for avoiding a destructive handoff race.

**How to apply:** Keep the save notice conditional on the user completing the
destination step. Clean partial writes before handoff and owned picker copies
after reading; never delete provider originals. Any future cache-retention
policy needs real-device late-recipient tests, not just a timeout. Tests with
injected native I/O prove app logic, not OS share/provider behavior.