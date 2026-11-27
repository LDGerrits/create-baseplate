---
title: How agents work in it
description: AGENTS.md, the check, the hooks, the skills and the language server.
---

## AGENTS.md

Every game has an `AGENTS.md`, which Claude Code (through `.claude/CLAUDE.md`), Codex, Cursor, Copilot and Gemini CLI (through `.gemini/settings.json`) read. It holds what the code can't show: where code goes and why, the rules the code follows, which test fits what, and what roblox-ts does differently from JavaScript.

Models know roblox-ts, Flamework and Rogen poorly, and the Roblox API changes faster than their training. So `AGENTS.md` opens by telling the agent to look things up rather than recall them, and where: the doc comments in `@rbxts/types` (each with a link to Roblox's docs, which serve Markdown), the `.d.ts` files and READMEs of the installed packages, `rogen doc`, and `mise run doc`, these docs as the game's create-baseplate version ships them. All of these match the versions the game has installed. Each add-on adds its own line, such as Charm's README, which is its full API. Agents follow docs that sit in `AGENTS.md` far more reliably than ones they'd have to decide to look for.

## The check

`mise run check` formats, compiles, lints, builds the place, verifies every import in it resolves, runs the tests and renders the UI stories, in about three seconds. The hooks run it when the agent stops and hand back what failed, so nothing depends on the agent remembering to; while it writes, they check each file it writes. The steps that don't need each other's result run at the same time (in a multi-place game, the places too), and only a failed step's output is printed. The tooling's own type-check and tests (of `scripts/` and `.agents/hooks/`) run when those files changed since they last passed, and always on CI.

Rules an agent would otherwise have to remember are part of the check, each failing with the fix in its message:

- **Layers and sides**: imports only go down the four layers, never in a cycle between features; each side's APIs stay on its side; files sit in side folders, named kebab-case (PascalCase in Luau).
- **What never runs**: a spec named or placed where Jest doesn't find it, a service or controller no entry script starts, a focused test (in TypeScript, a skipped one too).
- **What's untested or unseen**: a service without a spec, a feature with remotes and no end-to-end test, a component without a story. A file that rightly has none says why, such as `// no-spec: it only starts the spinner system`.
- **Trust and data**: a client-to-server remote with no rate limit, player data saved with `DataStoreService` by hand instead of through a data library.
- **Packages**: a plain npm package among a TypeScript game's runtime packages, and one of the game's packages installed in two versions.
- **Silenced tools**: a lint disable (`eslint-disable`, `selene: allow`) or a Luau `:: any` with no reason after ` -- `.

In a TypeScript game ESLint also names the Roblox API to use for each JavaScript global an agent reaches for (`console`, `setTimeout`, `JSON`, `Object`), and the check adds a hint to the compiler errors whose message doesn't say the fix.

## Hooks

The same hooks are set up for Claude Code, Codex, Cursor, GitHub Copilot (its cloud agent and CLI) and Gemini CLI:

- **Before the agent ends its turn**, the check runs; a failure goes back to the agent to fix, once. The check records the files it passed on, so when they are the same as at the last pass, whether the agent or the hook ran it, the check is skipped. In Cursor it runs only when the turn finished, not when you pressed Stop.
- **Before a command or an edit**, a guard blocks what agents get wrong in this project, and says what to do instead: editing generated files (and, in a Luau game, Wally's package folders), skipping the commit hook, npm, yarn or npx in place of pnpm (or, in a Luau game, Wally), printing `.env`, and publishing or touching the live game's data, from the shell or through Studio's MCP server (`open_cloud_invoke`, and `execute_luau` that reaches DataStores or HTTP).
- **After each file edit, and after each shell command that writes the game's files** (agents often write from the shell, with heredocs or sed), Biome formats the files and ESLint applies its fixes to them, then the problems left go back to the agent at once, instead of at the end of the turn. When no language server saw the write, because a shell command wrote it, the tool has none, or Claude Code's plugin isn't installed, the hook also type-checks: the compiler in a TypeScript game (about half a second), luau-lsp on the written files in a Luau game (one to two seconds). A command that runs a `mise` task, such as the check, reports for itself, so the hook stays out of it. In a TypeScript game the first edit starts a small server that keeps ESLint loaded (it stops after ten idle minutes, and restarts when anything but the edited file changed), so each edit after it takes about a fifth of a second; if the server can't be used, the hook lints in its own process. Set `BASEPLATE_ESLINT_SERVER=0` to never start it. After a change to `mise.toml` it runs `mise lock`, so the new pin installs; after a shell command, it reports a generated file the command wrote by hand, such as `src/world.d.ts` or a project file. Fixes that would undo what the agent is still writing are reported but not applied: removing an import not used yet, `let` to `const`, an import made type-only. Only the written files are linted; the check at the end of the turn covers the rest. Cursor doesn't show the agent what this hook says, so there it only applies the fixes. In a Luau game, StyLua formats the file and Selene lints it.
- **Each commit** runs `mise run ci`, the check without its fixes, on exactly what is being committed, whoever commits. It skips the check when it already passed on exactly the staged files, and when only Markdown is staged.

Each tool's config runs the same scripts in `.agents/hooks/`:

| Tool | Config |
| --- | --- |
| Claude Code | `.claude/settings.json` |
| Codex | `.codex/hooks.json` |
| Cursor | `.cursor/hooks.json` |
| GitHub Copilot | `.github/hooks/checks.json` |
| Gemini CLI | `.gemini/settings.json` |

A hook that can't find mise lets the agent carry on, so a machine without the tools never blocks it; the guard is the exception, and still blocks publishing and Studio's `open_cloud_invoke` and `execute_luau` when it can't run, since nothing else stops them. Codex runs project hooks once you trust them with `/hooks`, and Gemini CLI once you trust the folder. Copilot's CLI also reads `.claude/settings.json`, so there the hooks can run twice.

In Claude Code, the commands the skills use (`forge`, `ror`, `rogen`, `mise run`, and their `mise x --` forms) are allowed in `.claude/settings.json`, so the agent isn't stopped to ask.

## Skills

Skills in `.agents/skills/` cover what only some tasks need. `AGENTS.md` says when to read each, and the tools load the right one when the agent works on a story, a spec, the world or the packages: Claude Code through `.claude/rules/`, Cursor through `.cursor/rules/`, Copilot through `.github/instructions/`. Those rules load only when the tool's own file tools touch a file, and Codex and Gemini CLI have none, so the edit hook names the skill the first time in a session the agent writes such a file from the shell (`cat > file <<EOF`, as agents often do) or in Codex or Gemini CLI. After Claude Code or Gemini CLI compacts the conversation, the skills are named again, as Claude Code reloads its own rules then.

| Skill | For |
| --- | --- |
| `add-feature` | A new mechanic or screen: `mise run feature <name>` starts it, the skill walks through the rules, the network, the UI and the tests. |
| `write-tests` | A spec, an end-to-end test or an engine spec, and choosing between ree and real Studio. |
| `build-ui` | A component, a screen or the UI root: writing stories, looking at their pictures on any screen size, clicking into them, before and after a change. |
| `edit-world` | (Not with `--managed partial`.) The map and lighting in `world/`: looking at it, changing it in Studio or in files, syncing back. |
| `drive-studio` | Playtesting in real Studio through its MCP server. |
| `release` | Making a commit ready to publish. Agents don't publish: a hook stops it, and the skill says what to tell you. |
| `upgrade` | A Renovate update, a `.baseplate-new` file to merge, and the pins that need care (Rojo, Rogen, rbx-forge). |

## Type errors as it edits

In Claude Code, `mise run install` adds the project's language server, so the agent gets type errors and go-to-definition: TypeScript's, with the roblox-ts types, or in a Luau game luau-lsp, with the game's instances and Roblox's API typed. In a Luau game, the edit hook writes `sourcemap.json` again when an edit adds a module or changes the world, and luau-lsp reads it at once, so a new module or part is typed during the session, not only in the next one.

## Parallel and cloud agents

Each agent can work in its own git worktree, whichever tool made it. The check installs the locked packages before it starts, so a new worktree needs no setup, and a worktree without a `.env` of its own reads the main checkout's. Worktrees that Claude Code and Gemini CLI put inside the game, under `.claude/worktrees/` and `.gemini/worktrees/`, are gitignored, so the main checkout's check leaves them alone. rbx-forge gives each worktree its own Studio session.

`.agents/hooks/cloud-setup.sh` installs mise, the tools and the packages on a fresh Linux machine:

- Claude Code's cloud sessions run it as a startup hook.
- Cursor's cloud agents run it from `.cursor/environment.json`.
- Codespaces and dev containers run it from `.devcontainer/devcontainer.json`.
- For Codex cloud, set the environment's setup script to `bash .agents/hooks/cloud-setup.sh --force`.
- GitHub Copilot's cloud agent gets the same from `.github/workflows/copilot-setup-steps.yml`.

None of them has Roblox Studio, so story pictures there have no text.

## Keeping the agent files current

The agent files are `AGENTS.md`, the skills, the hooks and the agent tools' settings. They improve with each create-baseplate release, and a game keeps up with them. `package.json`'s `baseplate.version` pins the create-baseplate they come from, and Renovate updates it like a package, two weeks after a release. On Renovate's branch, `.github/workflows/renovate-fixups.yml` runs `create-baseplate sync`, which writes that version's agent files for the game's add-ons and merges them with the game's own edits the way git merges a branch:

- A file the game didn't touch takes the new version, and a file the template dropped goes, unless the game changed it.
- An edit the template didn't touch stays, and edits to different lines of the same file merge.
- A file the game deleted stays deleted.
- Where both changed the same lines, the game's file stays and the template's version goes beside it as `<file>.baseplate-new`. The check fails until someone merges it by hand and deletes that file.

`.baseplate/agent-files.json` records the files as the template last wrote them, the base of the next merge; the guard keeps agents from editing it. The check fails while the agent files lag behind the pin, and `mise run install` runs the sync when the pin moved. To move by hand, change `baseplate.version` in `package.json` and run `mise run install`, which runs the sync (an agent does the same, since the guard blocks `pnpm dlx`). Outside a game, or to only see whether anything would change, people run `pnpm dlx create-baseplate@<version> sync`, with `--check` to change nothing.

## Windows

`.claude/skills` links to `.agents/skills`. A clone where git doesn't make symbolic links checks it out as a small text file; `mise run install` turns it back into a link (a junction) and tells git to leave it alone.
