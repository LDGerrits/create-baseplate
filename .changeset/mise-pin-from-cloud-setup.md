---
"create-baseplate": patch
---

A game's workflows read mise's version from `.agents/hooks/cloud-setup.sh --pin` instead of pinning it themselves, so `create-baseplate sync` moves the game's mise in one place, and CI and cloud agents always run the same mise. A game created before this keeps the version in its workflows, since sync doesn't change workflows: replace each `version:` under `jdx/mise-action` with the step the template's workflows use, or move it by hand.
