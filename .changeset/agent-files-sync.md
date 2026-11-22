---
"create-baseplate": minor
---

A game's agent files (`AGENTS.md`, skills, hooks and the agent tools' settings) now keep up with create-baseplate. `package.json`'s `baseplate.version` pins the version they come from; Renovate updates it, and the game's `.github/workflows/renovate-fixups.yml` (formerly `mise-lock.yml`) runs the new `create-baseplate sync` on its branch, which brings the files up to that version and merges in the game's own edits, as git would. An edit that clashes leaves the template's version beside the file as `<file>.baseplate-new`, and the check fails until it's merged. `.baseplate/agent-files.json` records the base of that merge.
