---
"create-baseplate": patch
---

Fixes from watching real agent sessions build features in new games:

- In a TypeScript game, `mise run check` applies the fixes ESLint can make, as it does for formatting (not the ones that would undo half-written code, such as removing an import not used yet), and checks the fixed files again.
- `mise run ui` takes `--viewport`, so a layout can be checked at a small screen size, and finds `diff <ref>` wherever it sits among the arguments.
- An end-to-end test that times out says that ree doesn't emulate touch, physics or characters, and to test those in an engine spec.
- Test failures show only the game's own lines, not Jest's or the harness's.
- The guard reads each command of a chain on its own, so `ls .env && cat package.json` is no longer blocked.
- `AGENTS.md` covers the traps the agents hit: Remo's handlers typed with `player: Player` and where Remo's API is, Luau's `and` chains and `pcall`, roblox-ts method stubs, and showing before and after for a UI change.
