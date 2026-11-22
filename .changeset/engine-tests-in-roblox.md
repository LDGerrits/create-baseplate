---
"create-baseplate": patch
---

`mise run test:engine` now runs in a real Roblox server. The place it uploads is built from `test.project.json`, the game with `loadstring()` on, which Jest needs; the game itself keeps it off. With Lapis, the specs that load data skip in an Open Cloud session, where Lapis can't move because physics doesn't run.
