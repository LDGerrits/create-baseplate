---
title: The CLI
description: Every flag of create-baseplate, and how agents use it.
---

```sh
pnpm create baseplate [dir] [flags]
npm create baseplate@latest [dir] -- [flags]
```

With npm, the flags go after `--`: npm reads flags before it as its own, and the CLI stops with an error when that happens.

| Flag           | What                                                                       |
| -------------- | -------------------------------------------------------------------------- |
| `[dir]`        | The folder to create; its name names the game. Default: `my-game`.         |
| `-y, --yes`    | Take the defaults for everything not given, without asking.                |
| `--no-git`     | Don't make the project a git repo.                                         |
| `--no-install` | Don't install the tools and packages (with mise). |
| `--json`       | Print one JSON result on stdout. Implies `--yes`.                          |
| `--name <name>` | The game's name, when the folder's name can't be it. Default: the folder's name. |
| `--language <language>` | `luau` (default): Luau with Wally, StyLua, Selene and luau-lsp; or `typescript`: roblox-ts with Flamework. Asked first; each language has its own questions. |
| `--ui <library>` | UI: `vide` (Luau's default) or `react` (TypeScript's default). |
| `--places <layout>` | `single` (default), or `multi`: a lobby and a game sharing code, each place a folder in `projects/`. |
| `--managed <mode>` | `full` (default): Rojo manages the whole place, code and world as files, built and published from git; or `partial`: Rojo manages only the code, and Studio keeps the place and its world. |
| `--state <library>` | Client state: `reflex` (TypeScript only; its default), `charm` (Luau's default, and the default with Vide, which Reflex doesn't support) or `none`. |
| `--data <library>` | Player data: `profilestore`, `lapis` or `none` (default). |
| `--entities <library>` | Entities: `components` (TypeScript only), `jecs` or `none` (default). |
| `--assets <tool>` | Assets: `asphalt`, to upload images and sounds and type their IDs, or `none` (default). |
| `--release <tool>` | Release builds: `darklua`, to minify and optimize the code `mise run publish` uploads (not with `--managed partial`), or `none` (default). |
| `-V, --version` | Print the CLI's version. |

Without a terminal, as when an agent or CI runs it, it asks nothing and takes the defaults. The folder may be a fresh clone: `.git`, a license and the OS's own files stay, and a README, `.gitignore` or `.gitattributes` from GitHub is replaced by the template's, with a warning; the first commit goes on top of the clone's. See [add-ons](/add-ons/) for what each library choice adds.

## For agents

`pnpm create baseplate my-game --json` prints one line:

```json
{
	"ok": true,
	"name": "my-game",
	"dir": "/path/to/my-game",
	"language": "luau",
	"git": true,
	"committed": true,
	"installed": true,
	"addOns": { "ui": "vide", "places": "single", "managed": "full", "state": "charm", "data": "none", "entities": "none", "assets": "none", "release": "none" },
	"warnings": [],
	"nextSteps": ["cd my-game", "mise run check", "mise run dev"]
}
```

`git` says whether the game is a git repo of its own, and `committed` whether the first commit is made. With `--no-install` and add-ons that change the packages or bring a tool (the default state add-on alone adds packages; Asphalt and Darklua bring tools), the commit waits for the next steps, which bring them into `pnpm-lock.yaml` and `mise.lock`: `nextSteps` holds the commit. `warnings` says why git or a step was skipped.

If the first commit fails (its hook runs the game's check), the game stays in its folder, uncommitted, and the CLI exits with 1: the JSON has `"ok": false`, `"created": true`, an `error` with what the hook printed, and `nextSteps` ending in the commit command to run once the check passes.

On any other failure it prints `{ "ok": false, "error": "..." }` and exits with 1, or with 2 when npm kept the flags for itself (put them after `--`).

## Updating a game's agent files

```sh
pnpm dlx create-baseplate@<version> sync          # in the game's folder
pnpm dlx create-baseplate@<version> sync --check  # change nothing; exit 1 if anything would change
```

`sync` brings a game's agent files (`AGENTS.md`, skills, hooks and the agent tools' settings) up to that version's template, for the add-ons in `package.json`'s `baseplate.addOns`, and keeps the game's own edits. It exits with 1 when an edit clashes with the template's change, leaving the template's version beside the file as `<file>.baseplate-new`. Games normally don't need it run by hand: Renovate moves `baseplate.version` and the game's workflow runs the sync. To move by hand, change that version in `package.json` and run `mise run install`, which runs `sync` (an agent does this too: its guard blocks `pnpm dlx`). See [keeping the agent files current](/agents/#keeping-the-agent-files-current).

## Reading the docs offline

```sh
pnpm dlx create-baseplate@<version> doc            # list the topics
pnpm dlx create-baseplate@<version> doc testing    # print one page as Markdown
pnpm dlx create-baseplate@<version> doc --json     # { "ok": true, "topics": [...] } or { "ok": true, "topic", "text" }
```

`doc` prints the pages of this site as that version ships them, so an agent reads the docs for the version a game came from. In a game, `mise run doc <topic>` prints the copy the CLI keeps in `.baseplate/docs` when it creates the game and on each sync, so it works offline; a game without that copy runs `doc` at the version `package.json`'s `baseplate.version` pins. An unknown topic exits with 1 and names the closest one. To create a game in a folder named `doc`, write `./doc`.
