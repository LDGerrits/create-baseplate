---
title: Luau games
description: "The Luau route: its tools, where code goes, remotes, tests and UI."
---

The first question the CLI asks is the language. `--language luau` takes a different road from roblox-ts: its own template, with the tools Luau developers use, and its own add-on questions. It holds to the same standard for agents: one check, the hooks, the skills, tests in ree and stories in rur.

```sh
pnpm create baseplate my-game --language luau
```

## The tools

| | |
| --- | --- |
| Packages | [Wally](https://wally.run), in `wally.toml`; [wally-package-types](https://github.com/JohnnyMorganz/wally-package-types) carries each package's types into its link file |
| Types | [luau-lsp](https://github.com/JohnnyMorganz/luau-lsp), strict in every file (`.luaurc`), against every instance in the game |
| Lint and format | [Selene](https://github.com/Kampfkarren/selene) and [StyLua](https://github.com/JohnnyMorganz/StyLua) |
| Sync | [Rogen](https://github.com/LDGerrits/rogen) over [Rojo](https://rojo.space), and [rbx-forge](https://github.com/christopher-buss/rbx-forge) for Studio and syncback, as in roblox-ts games |
| Tests | [jest-lua](https://github.com/jsdotlua/jest-lua) from Wally, run in ree and through jest-roblox |
| UI | [react-lua](https://github.com/jsdotlua/react-lua) with [Ripple](https://github.com/littensy/ripple)'s hooks, or Vide with `--ui vide`; stories in UI Labs' format |

mise pins every tool and locks its checksums. The scripts, hooks and Rogen, rbx-forge and jest-roblox still run on Node, which mise installs: you write Luau, and `package.json` holds only those tools.

## Types for the whole game

`mise run generate` writes `sourcemap.json` from the game's code and its world, and luau-lsp reads it with `strictDatamodelTypes` on (`.vscode/settings.json`, which the check and the editor share). So `require(ReplicatedStorage.Shared.Features.Clicker.ClickerNetwork)` is typed by what that module returns, `workspace.SpawnLocation` is a `SpawnLocation`, and a module or part that isn't there fails the check. Roblox's API types come from the pinned luau-lsp's release, into `.luau-lsp/`, where an agent can search them.

## Where code goes

The same shape as a roblox-ts game, in Luau's naming: `src/Features/<Feature>/` with `Server/`, `Client/` and `Shared/` folders that Rogen routes, and PascalCase files. Modules are required by instance path, as `rogen where <file>` prints it; client code reaches other client code from `script`, since each player gets a copy of it.

Services and controllers are plain modules with a `start()` function. `src/App/Server/Main.server.luau` lists every service and starts each; `src/App/Client/Start.luau` does the same for controllers, then mounts the UI. The check fails on a `*Service.luau` or `*Controller.luau` neither lists.

## Remotes

A feature declares its remotes once, in `Shared/<Feature>Network.luau`:

```luau
return {
	click = Remote.clientEvent("click", t.tuple()) :: Remote.ClientEvent<()>,
	clicksChanged = Remote.serverEvent("clicksChanged") :: Remote.ServerEvent<number>,
}
```

The type gives both sides the arguments; the [`t`](https://github.com/osyrisrblx/t) check is what the server runs on what a client sends. The server takes client remotes only through `Serve.event` and `Serve.request`, which need a rate limit (`RateLimit.perSecond(20)`, or `RateLimit.trustsClient("<why>")`) and drop calls whose arguments fail the check. The check fails on `OnServerEvent` or `OnServerInvoke` anywhere else, and on client-visible code that reaches for `ServerScriptService` or `ServerStorage`.

## Tests and UI

Specs are `<Name>.spec.luau` beside the code, with Jest from `ReplicatedStorage.DevPackages.JestGlobals`; end-to-end tests are the same `tests/e2e/*.luau` harnesses as in a roblox-ts game. A failing frame names its file and line: `ServerScriptService.Features.Clicker.ClickerService.spec:22 → src/Features/Clicker/Server/ClickerService.spec.luau:22`. Stories are `<Component>.story.luau`, made with UI Labs' `CreateReactStory`, and `mise run ui` renders them as in a roblox-ts game.

## Several places

With `--places multi`, a Luau game takes Rogen's Luau layout: a `<place>.rogen.json` at the root for each place (`lobby`, `game`), the shared code in `projects/common/src`, and each place's entry scripts, world and end-to-end tests in `projects/<place>/`. Wally's packages stay at the root, shared. luau-lsp types each place with its own sourcemap, and the shared code's specs run in one place. Studio commands name the place: `mise run dev lobby`.

## Add-ons

The Luau questions offer what Luau games use: React or Vide, one place or several, Charm for state, ProfileStore or Lapis for saved data, Jecs for entities, Asphalt and Darklua. Reflex and Flamework Components are roblox-ts choices; the CLI refuses them in a Luau game. See [add-ons](/add-ons/).
