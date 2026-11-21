# agent-baseplate

A Roblox game template in roblox-ts, set up for AI coding agents: one command checks everything, tests and UI run without Studio, and the world lives in files. Works with Claude Code, Codex and Cursor.

## What it gives an agent

- **One command checks everything.** `mise run check` formats, compiles, type-checks, lints, builds the place, verifies every import in it resolves and runs the tests, in a few seconds.
- **Tests run without Studio.** Jest specs and end-to-end tests, with the real server and a client talking through remotes, run in [ree](https://github.com/Anime-Vanguards/roblox-engine-emulator), an emulated Roblox engine, in about a second. The same specs run in real Studio or Open Cloud through [jest-roblox](https://github.com/christopher-buss/jest-roblox-cli) (`mise run test:engine`).
- **It can see the UI.** `mise run ui` renders every story offline with [rur](https://github.com/Anime-Vanguards/roblox-ui-renderer) and prints where each picture is.
- **roblox-ts mistakes fail early.** Strict TypeScript, typed networking and ESLint's roblox-ts rules catch the JavaScript habits agents bring (`.length`, `null`, truthiness) and server code imported on the client.
- **The world is files, apart from the code.** Studio edits the map and [rbx-forge](https://github.com/christopher-buss/rbx-forge) syncs it back into `world/` as readable JSON, while Rojo serves only code. The map is typed: `Workspace.SpawnLocation` compiles only if it exists.
- **Each feature is one folder.** [Rogen](https://github.com/LDGerrits/rogen) routes its `server/`, `client/` and `shared/` folders to the right place in the game.
- **Instructions where agents look.** `AGENTS.md` covers the layout, adding a feature and the rules; `.agents/skills/` (linked as `.claude/skills/`) covers tests, the world and Studio. In Claude Code, a Stop hook runs the tests before the agent ends its turn.

## Stack

|           |                                                                                                                                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language  | TypeScript with [roblox-ts](https://roblox-ts.com), compiled by [Sloptor](https://github.com/howmanyslop/sloptor)                                                                                                            |
| Sync      | [Rogen](https://github.com/LDGerrits/rogen) over [Rojo](https://rojo.space); [rbx-forge](https://github.com/christopher-buss/rbx-forge) runs Studio and syncback                                                             |
| Framework | [Flamework](https://flamework.fireboltofdeath.dev): services, controllers, typed networking                                                                                                                                  |
| UI        | [React](https://github.com/jsdotlua/react-lua)                                                                                                                                                                               |
| Checks    | ESLint with typescript-eslint, eslint-plugin-roblox-ts and React's rules (react-hooks, react-x), Biome for formatting, Lune for place checks                                                                                 |
| Tests     | [Jest](https://github.com/jsdotlua/jest-lua) run in [ree](https://github.com/Anime-Vanguards/roblox-engine-emulator), and in Studio or Open Cloud through [jest-roblox](https://github.com/christopher-buss/jest-roblox-cli) |
| Tools     | [mise](https://mise.jdx.dev) pins every tool; pnpm installs packages                                                                                                                                                         |

## Getting started

Install [mise](https://mise.jdx.dev/getting-started.html), then:

```sh
mise install       # Node, pnpm, Rojo, Sloptor, Lune, ree, rur, ror
mise run install   # packages and the Rojo project file
mise run check     # everything should pass
mise run dev       # compile on save, open Studio on the world, serve the code
mise run sync      # write Studio's world edits into world/
```

Keys and local paths go in `.env`: copy `.env.example`, which lists each one.

## CI

`.github/workflows/ci.yml` runs `mise run ci` on Linux for every push and pull request: formatting, compile, lint, the place check, and the tests in ree. A second job runs every spec in real Roblox through Open Cloud once you add the repository secret `ROBLOX_OPEN_CLOUD_API_KEY` and the variables `ROBLOX_UNIVERSE_ID` and `ROBLOX_PLACE_ID` (Settings > Secrets and variables > Actions). Use a place made for tests: each run uploads to it. The key needs the `universe-places:write` and `universe.place.luau-execution-session:write` scopes on that universe; [jest-roblox's README](https://github.com/christopher-buss/jest-roblox-cli) has the details.

## Layout

```
src/
  app/                 entry scripts: start Flamework, mount the UI
  features/
    clicker/           an example feature
      server/          clicker-service.ts: owns the counts, checks the cooldown; its spec
      client/          clicker-controller.ts, clicker-button.tsx and its story
      shared/          clicker-network.ts
tests/e2e/             end-to-end tests: clicker.luau
world/                 the map and lighting, edited in Studio and synced back
```
