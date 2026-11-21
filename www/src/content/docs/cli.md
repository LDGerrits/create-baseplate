---
title: The CLI
description: Every flag of create-baseplate, and how agents use it.
---

```sh
pnpm create baseplate [dir] [flags]
```

| Flag           | What                                                                       |
| -------------- | -------------------------------------------------------------------------- |
| `[dir]`        | The folder to create; its name names the game. Default: `my-game`.         |
| `-y, --yes`    | Take the defaults for everything not given, without asking.                |
| `--no-git`     | Don't make the project a git repo.                                         |
| `--no-install` | Don't install the tools and packages (`mise install`, `mise run install`). |
| `--json`       | Print one JSON result on stdout. Implies `--yes`.                          |
| `-V, --version` | Print the CLI's version. |

Without a terminal, as when an agent or CI runs it, it asks nothing and takes the defaults.

## For agents

`pnpm create baseplate my-game --json` prints one line:

```json
{
	"ok": true,
	"name": "my-game",
	"dir": "/path/to/my-game",
	"git": true,
	"installed": true,
	"warnings": [],
	"nextSteps": ["cd my-game", "mise run check", "mise run dev"]
}
```

On failure it prints `{ "ok": false, "error": "..." }` and exits with 1.
