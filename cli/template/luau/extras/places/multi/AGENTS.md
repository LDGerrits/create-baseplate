## Where code goes

This game has several places, laid out as Rogen does for Luau: each place is a `<place>.rogen.json` at the root (`lobby.rogen.json`, `game.rogen.json`) with a folder in `projects/`, and the code they share is `projects/common/src`.

- `projects/common/src/features/<feature>/`: one folder per feature that several places use; `mise run feature <name>` starts one, and `features/clicker` is the example to copy.
- `projects/<place>/src/`: what only that place has. Its `app/` holds the entry scripts: `app/server/Main.server.luau` lists every service the place starts, shared ones included, and starts each; `app/client/Start.luau` (which `Main.client.luau` runs) does the same for controllers and mounts the UI; `app/client/App.luau` is the root of its UI. A feature only one place uses goes in `projects/<place>/src/features/`.
- Each `<place>.rogen.json` reads both: `sourcePaths` `["projects/common/src", "projects/<place>/src"]`, so a shared feature and a place's own land in the same folders of the game, and are required the same way. Rogen writes the place's code as `<place>.project.json` at the root.
- Each place's folder holds the rest of it: `world/` (its map), `tests/e2e/`, its forge and jest-roblox configs, and what the tasks write for the place (`game.project.json`, `sourcemap.json`, `build/`).
- The shared code's specs run in the `game` place only: every other `<place>.rogen.json` leaves them out with `globIgnorePaths`, so each runs once. Put an end-to-end test of shared code in `projects/game/tests/e2e/`, and a test of one place's own code in that place.

Inside a feature, the folder a file sits in decides where it runs:

- `server/`: only on the server, never sent to clients: `ServerScriptService.features.<feature>`. Rules, validation and secrets go here.
- `client/`: only on the player's device: `StarterPlayerScripts.features.<feature>`, copied into each player.
- `shared/`: both: `ReplicatedStorage.Shared.features.<feature>`. It can't require `server/` or `client/` code: the server's folders are empty on clients, and the check fails on client-visible code that reaches for `ServerScriptService` or `ServerStorage`.

A file outside these three folders isn't placed in the game, and the check fails on it: there's no default side, so server code can't reach clients by mistake.

Require by instance path, the way `rogen where <file>` prints it: `require(ReplicatedStorage.Shared.features.clicker.ClickerNetwork)`, `require(ServerScriptService.features.clicker.ClickerService)`. Client code is copied into each player at runtime, so it reaches other client code from `script`, as `projects/<place>/src/app/client/Start.luau` does: `script.Parent.Parent.features.clicker.ClickerController`. Shared code can't require what only one place has: the other places don't have it.

`mise run check` builds, type-checks and tests every place; Studio commands name one: `mise run dev lobby`, `mise run sync lobby`. luau-lsp types each place against its own sourcemap in the check; your editor types one place at a time, `game`, from `sourcemap.json` at the root: to switch, change the place in `luau-lsp.sourcemap.generatorCommand` in `.vscode/settings.json` and run `mise run generate`. Files are PascalCase, named after what they hold: `InventoryService.luau`.

Rogen's own section below gives the commands for a roblox-ts game's layout; here the configs are at the root. Run `rogen check` and `rogen write` from the root with no path, which covers every place, or name a place's config to work on one: `rogen write lobby`, `rogen check lobby`. `rogen where <path>` works on shared and place files alike.

A new place: copy `projects/lobby` to `projects/<place>` and `lobby.rogen.json` to `<place>.rogen.json`, and in the copy change `name` and the place's source path. `mise run check` then builds and tests it too.
