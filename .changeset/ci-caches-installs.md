---
"create-baseplate": patch
---

A game's CI keeps pnpm's packages between runs, so each job downloads only what changed in `pnpm-lock.yaml`.
