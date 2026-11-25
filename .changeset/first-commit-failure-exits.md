---
"create-baseplate": patch
---

When the first commit of a new game fails, because its hook's check fails, the CLI now exits with 1 and says so (with `--json`, `"ok": false` and an `error`), instead of exiting 0 with a warning. The game stays in its folder, uncommitted, and the next steps end with the commit to run.
