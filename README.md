# agent-baseplate

The Roblox game template built for AI coding agents. Strict types, one command that checks everything, and an architecture agents don't get lost in. Works with Claude Code, Codex and Cursor.

## Why it works well with agents

- **One command checks everything.** `mise run check` formats, compiles, type-checks, lints, builds the place and verifies every import in it resolves, in a few seconds. Agents run it after each change.
- **Mistakes fail before Studio.** Strict TypeScript, typed networking and ESLint's roblox-ts rules catch the JavaScript habits agents bring (`.length`, `null`, truthiness) and the Roblox ones (server code reaching clients).
- **Each feature is one folder.** [Rogen](https://github.com/LDGerrits/rogen) routes `server/`, `client/` and `shared/` folders to the right place in the game, so an agent finds everything about a feature in one place. Lint rules stop features from importing each other.
- **`AGENTS.md` explains the rules.** The layout, how to add a feature, never trusting the client, and the ways roblox-ts differs from JavaScript.

## Stack

|              |                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| Language     | TypeScript with [roblox-ts](https://roblox-ts.com), compiled by [Sloptor](https://github.com/howmanyslop/sloptor) |
| Sync         | [Rogen](https://github.com/LDGerrits/rogen) over [Rojo](https://rojo.space)                                       |
| Framework    | [Flamework](https://flamework.fireboltofdeath.dev): services, controllers, typed networking                       |
| State and UI | [Charm](https://github.com/littensy/charm) atoms, [React](https://github.com/jsdotlua/react-lua)                  |
| Checks       | ESLint with typescript-eslint and eslint-plugin-roblox-ts, Biome for formatting, Lune for place checks            |
| Tools        | [mise](https://mise.jdx.dev) pins every tool; pnpm installs packages                                              |

## Getting started

Install [mise](https://mise.jdx.dev/getting-started.html), then:

```sh
mise install       # Node, pnpm, Rojo, Sloptor, Lune
mise run install   # packages and the Rojo project file
mise run check     # everything should pass
mise run dev       # compile on save and serve to Studio
```

In Studio, install the Rojo plugin (`rogen plugin install`) and press Connect.

## Layout

```
src/
  app/                 entry scripts: start Flamework, mount the UI
  core/                what several features share
  features/
    clicker/           an example feature
      server/          clicker-service.ts: owns the counts, validates clicks
      client/          clicker-controller.ts, clicker-state.ts, clicker-button.tsx
      shared/          clicker-network.ts, clicker-rules.ts
```
