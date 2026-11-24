# Baseplate

The agent-ready way to start a Roblox game, in roblox-ts or Luau.

Baseplate creates a Roblox game, in TypeScript (roblox-ts) or Luau, that coding agents can work on well: one command checks everything, tests and UI run without Studio, hooks keep agents to the rules, and the world lives in files. It works with Claude Code, Codex, Cursor and Copilot.

> Not published yet.

```sh
pnpm create baseplate my-game      # asks a few questions
pnpm create baseplate my-game --yes  # takes the defaults: what agents and scripts use
```

It creates the game, makes it a git repo, and installs everything with [mise](https://mise.jdx.dev). `--json` prints one machine-readable result; `--no-git` and `--no-install` skip those steps.

The first question is the language, a fork in the road: `--language typescript` (the default) makes a roblox-ts game with Flamework, `--language luau` a Luau game with Wally, StyLua, Selene and luau-lsp. Each has its own template and the tools its developers use, and both get the same checks, hooks, tests and skills. Each add-on question has a flag; the first choice listed is the default, and a choice marked TS is for TypeScript games only:

| Flag         | Choices                                     |
| ------------ | ------------------------------------------- |
| `--language` | `typescript`, `luau`                        |
| `--ui`       | `react`, `vide`                             |
| `--places`   | `single`, `multi`                           |
| `--state`    | `none`, `charm`, `reflex` (TS)              |
| `--data`     | `none`, `profilestore`, `lapis`             |
| `--entities` | `none`, `components` (TS), `jecs`           |
| `--assets`   | `none`, `asphalt`                           |
| `--release`  | `none`, `darklua`                           |

## Repo

| Folder                 | What                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `cli/`                 | `create-baseplate`: prompts or flags, copies the template                             |
| `cli/template/<language>/base/`   | A language's game template (`typescript`, `luau`): a complete project that passes its own checks |
| `cli/template/<language>/extras/` | That language's add-ons, one folder per choice: UI, places, state, data, entities, assets and release |
| `www/`                 | The docs site: Astro with Starlight, with `llms.txt` for agents                       |

## License

MIT ([LICENSE](LICENSE)). The game template, `cli/template/`, is MIT No Attribution, so a game created with Baseplate is entirely yours: no notice to keep.
