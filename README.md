# agent-baseplate

The Roblox game template built for AI coding agents. Strict types, one command that checks everything, and an architecture agents don't get lost in. Works with Claude Code, Codex and Cursor.

## Why it works well with agents

- **One command checks everything.** `mise run check` formats, compiles, type-checks, lints, builds the place, verifies every import in it resolves and runs the tests, in a few seconds. Agents run it after each change.
- **Tests run without Studio.** Jest specs and end-to-end tests, with the real server and a client talking through remotes, run in [ree](https://github.com/Anime-Vanguards/roblox-engine-emulator), an emulated Roblox engine, in about a second. The same specs run in real Studio or Open Cloud through [jest-roblox](https://github.com/christopher-buss/jest-roblox-cli) (`mise run test:engine`). A Stop hook runs the tests before an agent ends its turn.
- **Agents can see the UI.** Each view has a story, and `mise run ui` renders every story offline with [rur](https://github.com/Anime-Vanguards/roblox-ui-renderer) and prints where each picture is, so an agent can look at what it built.
- **Mistakes fail before Studio.** Strict TypeScript, typed networking and ESLint's roblox-ts rules catch the JavaScript habits agents bring (`.length`, `null`, truthiness) and the Roblox ones (server code reaching clients).
- **Services are tested without Roblox's outside world.** Time, data stores, purchases and teleports go through interfaces in `src/platform`, so a test passes a fake; ESLint bans those services anywhere else.
- **The world is files, apart from the code.** Studio edits the map and [rbx-forge](https://github.com/christopher-buss/rbx-forge) syncs it back into `world/`, while Rojo serves only code, so syncing never overwrites code. The map is typed: `Workspace.SpawnLocation` compiles only if it exists.
- **Each feature is one folder.** [Rogen](https://github.com/LDGerrits/rogen) routes `server/`, `client/` and `shared/` folders to the right place in the game, so an agent finds everything about a feature in one place. Lint rules stop features from importing each other.
- **`AGENTS.md` explains the rules.** The layout, how to add a feature, never trusting the client, and the ways roblox-ts differs from JavaScript.
- **Skills for the bigger jobs.** `.agents/skills/` (linked as `.claude/skills/`) holds step-by-step guides for writing tests, building UI, wrapping a platform service, editing the world and driving Studio; `AGENTS.md` points to each.

## Stack

|              |                                                                                                                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language     | TypeScript with [roblox-ts](https://roblox-ts.com), compiled by [Sloptor](https://github.com/howmanyslop/sloptor)                                                                                                            |
| Sync         | [Rogen](https://github.com/LDGerrits/rogen) over [Rojo](https://rojo.space); [rbx-forge](https://github.com/christopher-buss/rbx-forge) runs Studio and syncback                                                             |
| Framework    | [Flamework](https://flamework.fireboltofdeath.dev): services, controllers, typed networking                                                                                                                                  |
| State and UI | [Charm](https://github.com/littensy/charm) atoms, [React](https://github.com/jsdotlua/react-lua)                                                                                                                             |
| Checks       | ESLint with typescript-eslint and eslint-plugin-roblox-ts, Biome for formatting, Lune for place checks                                                                                                                       |
| Tests        | [Jest](https://github.com/jsdotlua/jest-lua) run in [ree](https://github.com/Anime-Vanguards/roblox-engine-emulator), and in Studio or Open Cloud through [jest-roblox](https://github.com/christopher-buss/jest-roblox-cli) |
| Tools        | [mise](https://mise.jdx.dev) pins every tool; pnpm installs packages                                                                                                                                                         |

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
  core/                what several features share
  platform/            Roblox's outside world behind interfaces, with fakes for tests
    clock/             Clock, systemClock, FakeClock
  features/
    clicker/           an example feature
      server/          clicker-service.ts: owns the counts, validates clicks
      client/          clicker-controller.ts, clicker-state.ts, use-clicker.ts,
                       clicker-button.tsx (a view) and its story
      shared/          clicker-network.ts, clicker-rules.ts, clicker-rules.spec.ts
tests/e2e/             end-to-end tests: clicker.luau
world/                 the map and lighting, edited in Studio and synced back
```
