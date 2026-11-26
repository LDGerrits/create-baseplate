---
"create-baseplate": patch
---

A game's root holds fewer files: `CLAUDE.md` moves to `.claude/CLAUDE.md`, and the commit hook's lint-staged settings move into `scripts/pre-commit.ts`. In VS Code and Cursor the explorer folds each config under the file it belongs with, starting collapsed, hides the tools' caches, and keeps the generated `*.project.json` files under the `*.rogen.json` that makes them. `create-baseplate sync` moves `CLAUDE.md` in an existing game unless the game changed it.
