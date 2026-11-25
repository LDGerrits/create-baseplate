---
"create-baseplate": minor
---

`mise run errors -- <version>` lists the errors first seen in a place version, most frequent first and with stack traces, from Roblox's Error Reporting API; `-- --hours 6` takes the last hours instead. It only reads, with a key of its own (`ROBLOX_ERRORS_API_KEY`, with only `universe.analytics:read`), and the release skill tells agents to run it after a publish to dev.
