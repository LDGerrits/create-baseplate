---
"create-baseplate": patch
---

Fixes from an adversarial review of the template, for agents and people:

- The generated project files, world types and Luau sourcemap are written only when they change, so a check no longer restarts the ESLint server (the next edit's lint stays at a fraction of a second) or makes luau-lsp reload.
- A Luau game's packages install beside the old ones and swap in only when Wally succeeds, so an install offline keeps the packages the game had; installs from a check and the edit hook no longer run at once; Roblox's types download through `HTTPS_PROXY` and say what they need when offline.
- `mise run test:engine` finds Windows Studio from WSL by itself, as `mise run ui` does.
- `mise run ui -- --help` lists its options, and `AGENTS.md` shows `--controls` for rendering a story in another state. Stories in `src/app/` appear in UI Labs.
- The check names the files it fixed; a passing commit prints nothing; a game with no tests says so.
- `AGENTS.md` adds a Player data section (replaced by a data add-on's), how to find another place's ID in a multi-place game, how App.luau requires a feature's component, and the write-tests skill says ree has no character or physics. Wrong pointers are fixed.
- Searches skip `.baseplate/agent-files.json`, the record `create-baseplate sync` merges against.
