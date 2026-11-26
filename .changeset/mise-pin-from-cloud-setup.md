---
"create-baseplate": patch
---

A game's workflows read mise's version from `.agents/hooks/cloud-setup.sh --pin` instead of pinning it themselves, so `create-baseplate sync` moves the game's mise in one place, and CI and cloud agents always run the same mise.
