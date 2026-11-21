---
title: How agents work in it
description: AGENTS.md, the check, the hooks, the skills and the language server.
---

## AGENTS.md

Every game has an `AGENTS.md`, which Claude Code (through `CLAUDE.md`), Codex, Cursor and Copilot read. It holds what the code can't show: where code goes and why, the rules the code follows, which test fits what, and what roblox-ts does differently from JavaScript.

## The check

`mise run check` formats, compiles, lints, builds the place, verifies every import in it resolves, and runs the tests, in about five seconds. The agent runs it after each change.

## Hooks

The same hooks are set up for Claude Code, Codex and Cursor:

- **Before the agent ends its turn**, the check runs; a failure goes back to the agent to fix.
- **Before a command or an edit**, a guard blocks what agents get wrong in this project, and says what to do instead: editing generated files, skipping the commit hook, npm, yarn or npx in place of pnpm, and printing `.env`.
- **Each commit** runs `mise run ci`, the check without its fixes, on exactly what is being committed, whoever commits.

Codex runs project hooks once you trust them with `/hooks`.

## Skills

Skills in `.agents/skills/` cover what only some tasks need: writing tests, editing the world, and driving Roblox Studio through its MCP server. `AGENTS.md` says when to read each.

## Type errors as it edits

In Claude Code, `mise run install` adds the project's TypeScript language server, so the agent gets type errors and go-to-definition with the roblox-ts types.

## Parallel and cloud agents

- `.worktreeinclude` copies `.env` into new git worktrees.
- In Claude Code's cloud sessions, a startup hook installs mise, the tools and the packages.
- GitHub Copilot's cloud agent gets them from `.github/workflows/copilot-setup-steps.yml`.

Neither cloud has Roblox Studio, so story pictures there have no text.
