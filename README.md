# Baseplate

The agent-ready way to start a roblox-ts game.

Baseplate creates a Roblox game in TypeScript that coding agents can work on well: one command checks everything, tests and UI run without Studio, hooks keep agents to the rules, and the world lives in files. It works with Claude Code, Codex, Cursor and Copilot.

> Not published yet.

```sh
pnpm create baseplate my-game      # asks a few questions
pnpm create baseplate my-game --yes  # takes the defaults: what agents and scripts use
```

It creates the game, makes it a git repo, and installs everything with [mise](https://mise.jdx.dev). `--json` prints one machine-readable result; `--no-git` and `--no-install` skip those steps.

## Repo

| Folder                 | What                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| `cli/`                 | `create-baseplate`: prompts or flags, copies the template        |
| `cli/template/base/`   | The game template: a complete project that passes its own checks |
| `cli/template/extras/` | Add-ons: one folder per choice of UI, places, state, player data, entities, assets and release builds |
| `www/`                 | The docs site: Astro with Starlight, with `llms.txt` for agents  |

`PLAN.md` holds the plan.

## License

MIT ([LICENSE](LICENSE)). The game template, `cli/template/`, is MIT No Attribution, so a game created with Baseplate is entirely yours: no notice to keep.
