---
"create-baseplate": patch
---

- An end-to-end test's failure points at its file (`tests/e2e/shop.luau:38`), as a spec's does.
- In a Luau game, `mise run install` after a `wally.toml` change prints a few lines, not wally-package-types' line per file.
- With Asphalt, `mise run assets` says to set `ASPHALT_API_KEY` in `.env` when it's missing, and the check's `assets` step says to run `mise run assets` for files not uploaded yet.
- In a multi-place TypeScript game, the add-ons' notes in `AGENTS.md` name each place's `world/` and the UI controller's path in the place.
