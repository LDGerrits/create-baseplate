# create-baseplate

Creates a roblox-ts game set up for coding agents.

```sh
pnpm create baseplate my-game
npm create baseplate@latest my-game
```

With npm, put the flags after `--`, as in `npm create baseplate@latest my-game -- --yes`: npm reads flags before it as its own.

| Flag                   | What                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `[dir]`                | The folder to create; its name names the game. Default: `my-game`.                           |
| `-y, --yes`            | Take the defaults for everything not given, without asking.                                  |
| `--no-git`             | Don't make the project a git repo.                                                           |
| `--no-install`         | Don't install the tools and packages (with mise).                                            |
| `--json`               | Print one JSON result on stdout, for agents and scripts. Implies `--yes`.                    |
| `--name <name>`        | The game's name, when the folder's name can't be it. Default: the folder's name.             |
| `--language <language>` | `typescript` (default): roblox-ts with Flamework; or `luau`: Luau with Wally, StyLua, Selene and luau-lsp. Asked first; each language has its own questions. |
| `--ui <library>`       | UI: `react` (default) or `vide`.                                                             |
| `--places <layout>`    | `single` (default), or `multi`: a lobby and a game sharing code, laid out as Rogen does.     |
| `--state <library>`    | Client state: `charm`, `reflex` (TypeScript only) or `none` (default).                       |
| `--data <library>`     | Player data: `profilestore`, `lapis` or `none` (default).                                    |
| `--entities <library>` | Entities: `components` (TypeScript only), `jecs` or `none` (default).                        |
| `--assets <tool>`      | Assets: `asphalt`, to upload images and sounds and type their IDs, or `none` (default).      |
| `--release <tool>`     | Release builds: `darklua`, to minify and optimize the code you publish, or `none` (default). |
| `-V, --version`        | Print the CLI's version.                                                                     |

Without a terminal (an agent, CI) it asks nothing and takes the defaults. Installing needs [mise](https://mise.jdx.dev/getting-started.html).
