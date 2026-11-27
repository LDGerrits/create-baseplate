---
"create-baseplate": patch
---

A game's `AGENTS.md` now lays out how the check and the hooks work together: the hooks check each file as it's written, the agent runs `mise run check` once when the work is done and after each round of fixes, and the hooks run it again on stop and commit. In TypeScript games, the check now turns an import used only as a type into `import type` itself (the edit hook still leaves it, since the code may be half-written), and `no-unnecessary-type-parameters` is off: it flagged ordinary generic helpers and couldn't fix them.
