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
| Sync | [Rogen](https://github.com/LDGerrits/rogen) over [Rojo](https://rojo.space), and [rbx-forge](https://github.com/christopher-buss/rbx-forge) for Studio and syncback (not with `--managed partial`, where `mise run dev` only serves the code), as in roblox-ts games |
| Tests | [jest-lua](https://github.com/jsdotlua/jest-lua) from Wally, run in ree and through jest-roblox |
| UI | [react-lua](https://github.com/jsdotlua/react-lua) with [Ripple](https://github.com/littensy/ripple)'s hooks, or Vide with `--ui vide`; stories in UI Labs' format |

mise pins every tool and locks its checksums. The scripts, hooks and Rogen, rbx-forge and jest-roblox still run on Node, which mise installs: you write Luau, and `package.json` holds only those tools.

## Types for the whole game

`mise run generate` writes `sourcemap.json` from the game's code and its world (with `--managed partial`, from the code alone, so `workspace.SpawnLocation` fails the check and a game reaches the world with `WaitForChild`), and luau-lsp reads it with `strictDatamodelTypes` on (`.vscode/settings.json`, which the check and the editor share). So `require(ReplicatedStorage.Shared.features.shop.ShopNetwork)` is typed by what that module returns, `workspace.SpawnLocation` is a `SpawnLocation`, and a module or part that isn't there fails the check. Roblox's API types come from the pinned luau-lsp's release, into `.luau-lsp/`, where an agent can search them.

## Where code goes

The same four layers as a roblox-ts game (see [the project's shape](/project/)), in Luau's naming: `src/features/<feature>/`, `src/game/<system>/` and `src/platform/<module>/`, each with lowercase `server/`, `client/` and `shared/` folders that Rogen routes, lowercase letters and digits in folder names, and PascalCase files. Modules are required by instance path, as `rogen where <file>` prints it; client code reaches other client code from `script`, since each player gets a copy of it. The check reads every `require` through `sourcemap.json`, so a `game/` module that requires a feature, or two features that require each other, fail it however the path is written.

Services and controllers are plain modules with a `start()` function. `src/app/server/Main.server.luau` lists every service and starts each; `src/app/client/Start.luau` does the same for controllers, and both lists start with only what the add-ons bring: `mise run feature <name>` writes a feature's files and adds its service and controller. The game has no UI root yet; the UI section of its `AGENTS.md` says how to mount one. The check fails on a `*Service.luau` or `*Controller.luau` neither lists.

## Remotes

A feature declares its remotes once, in `shared/<Feature>Network.luau`, with [Remo](https://github.com/littensy/remo):

```luau
type Remotes = {
	shop: {
		buy: Remo.ClientToServer<string>,
		coinsChanged: Remo.ServerToClient<number>,
	},
}

local remotes: Remotes = Remo.createRemotes({
	shop = Remo.namespace({
		buy = Remo.remote(t.string).middleware(Remo.throttleMiddleware(1)),
		coinsChanged = Remo.remote(t.number),
	}),
})

return remotes.shop
```

The type gives both sides the arguments. Remo runs the [`t`](https://github.com/osyrisrblx/t) validators on what arrives before any handler sees it, so each argument a client sends gets one, and `throttleMiddleware` drops a player's floods. The namespace keeps a feature's remote names apart from other features'. The check fails on `OnServerEvent` or `OnServerInvoke` in the game's own code, which would take what clients send with neither, and on client-visible code that reaches for `ServerScriptService` or `ServerStorage`.

## Tests and UI

Specs are `<Name>.spec.luau` beside the code, with Jest from `ReplicatedStorage.DevPackages.JestGlobals`; end-to-end tests are the same `tests/e2e/*.luau` harnesses as in a roblox-ts game. A failing frame names its file and line: `ServerScriptService.features.shop.ShopService.spec:22 → src/features/shop/server/ShopService.spec.luau:22`. Stories are `<Component>.story.luau`, made with UI Labs' `CreateReactStory` (`CreateVideStory` with Vide), and `mise run ui` renders them as in a roblox-ts game.

## Several places

With `--places multi`, a Luau game takes Rogen's Luau layout: a `<place>.rogen.json` at the root for each place (`lobby`, `game`), the shared code in `projects/common/src`, and each place's entry scripts, world and end-to-end tests in `projects/<place>/`. Wally's packages stay at the root, shared. luau-lsp types each place with its own sourcemap, and the shared code's specs run in one place. Studio commands name the place: `mise run dev lobby`.

## Add-ons

The Luau questions offer what Luau games use: React or Vide, one place or several, Charm for state, ProfileStore or Lapis for saved data, Jecs for entities, Asphalt and Darklua. Reflex and Flamework Components are roblox-ts choices; the CLI refuses them in a Luau game. See [add-ons](/add-ons/).
