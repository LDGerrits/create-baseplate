## Where code goes

This game has several places, laid out as Rogen does for Luau: each place is a `<place>.rogen.json` at the root (`lobby.rogen.json`, `game.rogen.json`) with a folder in `projects/`, and the code they share is `projects/common/src`.

- `projects/common/src/Features/<Feature>/`: one folder per feature that several places use; `Features/Clicker` is the example to copy. `projects/common/src/Network/` holds the remotes (`Shared/Remote.luau`) and how the server takes them (`Server/Serve.luau`, `Server/RateLimit.luau`).
- `projects/<place>/src/`: what only that place has. Its `App/` holds the entry scripts: `App/Server/Main.server.luau` lists every service the place starts, shared ones included, and starts each; `App/Client/Start.luau` (which `Main.client.luau` runs) does the same for controllers and mounts the UI; `App/Client/App.luau` is the root of its UI. A feature only one place uses goes in `projects/<place>/src/Features/`.
- Each `<place>.rogen.json` reads both: `sourcePaths` `["projects/common/src", "projects/<place>/src"]`, so a shared feature and a place's own land in the same folders of the game, and are required the same way. Rogen writes the place's code as `<place>.project.json` at the root.
- Each place's folder holds the rest of it: `world/` (its map), `tests/e2e/`, its forge and jest-roblox configs, and what the tasks write for the place (`game.project.json`, `sourcemap.json`, `build/`).
- The shared code's specs run in the `game` place only: every other `<place>.rogen.json` leaves them out with `globIgnorePaths`, so each runs once. Put an end-to-end test of shared code in `projects/game/tests/e2e/`, and a test of one place's own code in that place.

Inside a feature, the folder a file sits in decides where it runs:

- `Server/`: only on the server, never sent to clients: `ServerScriptService.Features.<Feature>`. Rules, validation and secrets go here.
- `Client/`: only on the player's device: `StarterPlayerScripts.Features.<Feature>`, copied into each player.
- `Shared/`: both: `ReplicatedStorage.Shared.Features.<Feature>`. It can't require `Server/` or `Client/` code: the server's folders are empty on clients, and the check fails on client-visible code that reaches for `ServerScriptService` or `ServerStorage`.

A file outside these three folders isn't placed in the game, and the check fails on it: there's no default side, so server code can't reach clients by mistake.

Require by instance path, the way `rogen where <file>` prints it: `require(ReplicatedStorage.Shared.Features.Clicker.ClickerNetwork)`, `require(ServerScriptService.Network.Serve)`. Client code is copied into each player at runtime, so it reaches other client code from `script`, as `projects/<place>/src/App/Client/Start.luau` does: `script.Parent.Parent.Features.Clicker.ClickerController`. Shared code can't require what only one place has: the other places don't have it.

`mise run check` builds, type-checks and tests every place; Studio commands name one: `mise run dev lobby`, `mise run sync lobby`. luau-lsp types each place against its own sourcemap in the check; your editor types one place at a time, `game`, from `sourcemap.json` at the root: to switch, change the place in `luau-lsp.sourcemap.generatorCommand` in `.vscode/settings.json` and run `mise run generate`. Files are PascalCase, named after what they hold: `InventoryService.luau`.

A new place: copy `projects/lobby` to `projects/<place>` and `lobby.rogen.json` to `<place>.rogen.json`, and in the copy change `name` and the place's source path. `mise run check` then builds and tests it too.
