---
title: How agents work in it
description: AGENTS.md, the check, the hooks, the skills and the language server.
---

## AGENTS.md

Every game has an `AGENTS.md`, which Claude Code (through `CLAUDE.md`), Codex, Cursor, Copilot and Gemini CLI (through `.gemini/settings.json`) read. It holds what the code can't show: where code goes and why, the rules the code follows, which test fits what, and what roblox-ts does differently from JavaScript.

Models know roblox-ts, Flamework and Rogen poorly, and the Roblox API changes faster than their training. So `AGENTS.md` opens by telling the agent to look things up rather than recall them, and where: the doc comments in `@rbxts/types` (each with a link to Roblox's docs, which serve Markdown), the `.d.ts` files and READMEs of the installed packages, and `rogen doc`. All of these match the versions the game has installed. Each add-on adds its own line, such as Charm's README, which is its full API. Agents follow docs that sit in `AGENTS.md` far more reliably than ones they'd have to decide to look for.

## The check

`mise run check` formats, compiles, lints, builds the place, verifies every import in it resolves, runs the tests and renders the UI stories, in about ten seconds. The agent runs it after each change.

## Hooks

The same hooks are set up for Claude Code, Codex, Cursor, GitHub Copilot (its cloud agent and CLI) and Gemini CLI:

- **Before the agent ends its turn**, the check runs; a failure goes back to the agent to fix, once. When nothing changed since the last pass, the check is skipped. In Cursor it runs only when the turn finished, not when you pressed Stop.
- **Before a command or an edit**, a guard blocks what agents get wrong in this project, and says what to do instead: editing generated files, skipping the commit hook, npm, yarn or npx in place of pnpm, and printing `.env`.
- **After each file edit**, Biome formats the file and ESLint applies its fixes to it, then the lint problems left go back to the agent at once, in a few seconds, instead of at the end of the turn. Fixes that would undo what the agent is still writing are reported but not applied: removing an import not used yet, `let` to `const`, an import made type-only. Only the edited file is linted and the compiler doesn't run; the check at the end of the turn covers the rest. Cursor doesn't show the agent what this hook says, so there it only applies the fixes.
- **Each commit** runs `mise run ci`, the check without its fixes, on exactly what is being committed, whoever commits.

Each tool's config runs the same scripts in `.agents/hooks/`:

| Tool | Config |
| --- | --- |
| Claude Code | `.claude/settings.json` |
| Codex | `.codex/hooks.json` |
| Cursor | `.cursor/hooks.json` |
| GitHub Copilot | `.github/hooks/checks.json` |
| Gemini CLI | `.gemini/settings.json` |

A hook that can't find mise does nothing, so a machine without the tools never blocks the agent. Codex runs project hooks once you trust them with `/hooks`, and Gemini CLI once you trust the folder. Copilot's CLI also reads `.claude/settings.json`, so there the hooks can run twice.

In Claude Code, the commands the skills use (`forge`, `ror`, `rogen`, `mise run`, and their `mise x --` forms) are allowed in `.claude/settings.json`, so the agent isn't stopped to ask.

## Skills

Skills in `.agents/skills/` cover what only some tasks need: writing tests, editing the world, and driving Roblox Studio through its MCP server. `AGENTS.md` says when to read each.

## Type errors as it edits

In Claude Code, `mise run install` adds the project's TypeScript language server, so the agent gets type errors and go-to-definition with the roblox-ts types.

## Parallel and cloud agents

- `.worktreeinclude` copies `.env` into new git worktrees.
`.agents/hooks/cloud-setup.sh` installs mise, the tools and the packages on a fresh Linux machine:

- Claude Code's cloud sessions run it as a startup hook.
- Cursor's cloud agents run it from `.cursor/environment.json`.
- Codespaces and dev containers run it from `.devcontainer/devcontainer.json`.
- For Codex cloud, set the environment's setup script to `bash .agents/hooks/cloud-setup.sh --force`.
- GitHub Copilot's cloud agent gets the same from `.github/workflows/copilot-setup-steps.yml`.

None of them has Roblox Studio, so story pictures there have no text.

## Windows

`.claude/skills` links to `.agents/skills`. A clone where git doesn't make symbolic links checks it out as a small text file; `mise run install` turns it back into a link (a junction) and tells git to leave it alone.
