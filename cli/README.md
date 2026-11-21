# create-baseplate

Creates a roblox-ts game set up for coding agents.

```sh
pnpm create baseplate my-game
npm create baseplate@latest my-game
```

| Flag                   | What                                                                      |
| ---------------------- | ------------------------------------------------------------------------- |
| `[dir]`                | The folder to create; its name names the game. Default: `my-game`.        |
| `-y, --yes`            | Take the defaults for everything not given, without asking.               |
| `--no-git`             | Don't make the project a git repo.                                        |
| `--no-install`         | Don't install the tools and packages (with mise).                         |
| `--json`               | Print one JSON result on stdout, for agents and scripts. Implies `--yes`. |
| `--ui <library>`       | UI: `react` (default) or `vide`.                                          |
| `--state <library>`    | Client state: `charm`, `reflex` or `none` (default).                      |
| `--data <library>`     | Player data: `profilestore`, `lapis` or `none` (default).                 |
| `--entities <library>` | Entities: `components`, `jecs` or `none` (default).                       |

Without a terminal (an agent, CI) it asks nothing and takes the defaults. Installing needs [mise](https://mise.jdx.dev/getting-started.html).
