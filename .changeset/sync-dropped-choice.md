---
"create-baseplate": patch
---

`create-baseplate sync` refuses a game whose recorded add-on this version doesn't have, or whose add-ons it can't put together, instead of syncing as if the game never had it and dropping that add-on's section from `AGENTS.md`.
