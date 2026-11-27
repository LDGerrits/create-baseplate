---
"create-baseplate": patch
---

A game's `AGENTS.md` no longer tells agents to run `mise run check` after each change: the hooks already report problems in each file as it's written and run the whole check when the agent stops and on commit, so it now says what the hooks do and to run the check by hand only in a tool without them. In TypeScript games, the check now turns an import used only as a type into `import type` itself (the edit hook still leaves it, since the code may be half-written), and `no-unnecessary-type-parameters` is off: it flagged ordinary generic helpers and couldn't fix them.
