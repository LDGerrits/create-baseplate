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
| `--ui <library>` | UI: `react` (default) or `vide`. |
| `--places <layout>` | `single` (default), or `multi`: a lobby and a game sharing code, laid out as Rogen does. |
| `--state <library>` | Client state: `charm`, `reflex` or `none` (default). |
| `--data <library>` | Player data: `profilestore`, `lapis` or `none` (default). |
| `--entities <library>` | Entities: `components`, `jecs` or `none` (default). |
| `--assets <tool>` | Assets: `asphalt`, to upload images and sounds and type their IDs, or `none` (default). |
| `--release <tool>` | Release builds: `darklua`, to minify and optimize the code you publish, or `none` (default). |
| `-V, --version` | Print the CLI's version. |

Without a terminal, as when an agent or CI runs it, it asks nothing and takes the defaults. The folder may be a fresh clone: `.git`, a license and the OS's own files stay, and a README, `.gitignore` or `.gitattributes` from GitHub is replaced by the template's, with a warning; the first commit goes on top of the clone's. See [add-ons](/add-ons/) for what each library choice adds.

## For agents

`pnpm create baseplate my-game --json` prints one line:

```json
{
	"ok": true,
	"name": "my-game",
	"dir": "/path/to/my-game",
	"git": true,
	"committed": true,
	"installed": true,
	"addOns": { "ui": "react", "places": "single", "state": "none", "data": "none", "entities": "none", "assets": "none", "release": "none" },
	"warnings": [],
	"nextSteps": ["cd my-game", "mise run check", "mise run dev"]
}
```

`git` says whether the game is a git repo of its own, and `committed` whether the first commit is made. With `--no-install` and add-ons that change the packages or bring a tool (Asphalt, Darklua), the commit waits for the next steps, which bring them into `pnpm-lock.yaml` and `mise.lock`: `nextSteps` holds the commit. `warnings` says why git or a step was skipped.

On failure it prints `{ "ok": false, "error": "..." }` and exits with 1, or with 2 when npm kept the flags for itself (put them after `--`).

## Updating a game's agent files

```sh
pnpm dlx create-baseplate@<version> sync          # in the game's folder
pnpm dlx create-baseplate@<version> sync --check  # change nothing; exit 1 if anything would change
```

`sync` brings a game's agent files (`AGENTS.md`, skills, hooks and the agent tools' settings) up to that version's template, for the add-ons in `package.json`'s `baseplate.addOns`, and keeps the game's own edits. It exits with 1 when an edit clashes with the template's change, leaving the template's version beside the file as `<file>.baseplate-new`. Games normally don't need it run by hand: see [keeping the agent files current](/agents/#keeping-the-agent-files-current).
