## Where code goes

This game has several places, laid out as Rogen does for Luau: each place is a `<place>.rogen.json` at the root (`lobby.rogen.json`, `game.rogen.json`) with a folder in `projects/`, and the code they share is `projects/common/src`.

- `projects/common/src/`: the layers' folders for what several places use: `features/<feature>/` (`mise run feature <name>` starts one), `game/<system>/` and `platform/<module>/`. The game starts with none.
- `projects/<place>/src/`: what only that place has. Its `app/` holds the entry scripts: `app/server/Main.server.luau` lists every service the place starts, shared ones included, and starts each; `app/client/Start.luau` (which `Main.client.luau` runs) does the same for controllers. Both lists start with only the services and controllers the add-ons bring (none, in a game without add-ons), and a place has no UI root yet: `.agents/skills/build-ui/SKILL.md` shows how to add one. Its own features, systems and modules sit beside `app/`, in the same layers.
- Each `<place>.rogen.json` reads both: `sourcePaths` `["projects/common/src", "projects/<place>/src"]`, so a shared feature and a place's own land in the same folders of the game, and are required the same way. Rogen writes the place's code as `<place>.project.json` at the root.
- Each place's folder holds the rest of it: `world/` (its map), `tests/e2e/`, its forge and jest-roblox configs, and what the tasks write for the place (`game.project.json`, `sourcemap.json`, `build/`).
- To send players to another place, look its ID up by name on the server, with `AssetService:GetGamePlacesAsync()` (pages of `Name` and `PlaceId`), and teleport with `TeleportService`. Don't write the IDs down: each place has another ID in dev, stable and prod. ree doesn't emulate either, so test the lookup in an engine spec.
- The shared code's specs run in the `game` place only: every other `<place>.rogen.json` leaves them out with `globIgnorePaths`, so each runs once. Put an end-to-end test of shared code in `projects/game/tests/e2e/`, and a test of one place's own code in that place.

The four layers sit in each source root, `projects/common/src` and `projects/<place>/src`, and a module requires only down: `app`, then `features`, then `game`, then `platform`. A place may require the shared code; the shared code never requires a place, and a place never requires another. The check fails on any of them.

- `app/`: a place's entry scripts only, so only in `projects/<place>/src/app/`. It may require every layer.
- `features/<feature>/`: what the game could ship without. It may require `game`, `platform` and other features, never in a cycle between features.
- `game/<system>/`: the always-on systems and what features build on; it never requires a feature or `app`.
- `platform/<module>/`: game-agnostic code that would move unchanged to another game; it requires none of the others.

A feature or a system? Delete the folder: if the game still works, it's a feature; if other code breaks, it belongs in `game/`.

Inside a feature or module, and in `app/`, the folder a file sits in decides where it runs:

- `server/`: only on the server, never sent to clients: `ServerScriptService.features.<feature>`. Rules, validation and secrets go here.
- `client/`: only on the player's device: `StarterPlayerScripts.features.<feature>`, copied into each player.
- `shared/`: both: `ReplicatedStorage.Shared.features.<feature>`. It can't require `server/` or `client/` code: the server's folders are empty on clients, and the check fails on client-visible code that reaches for `ServerScriptService` or `ServerStorage`.

Require by instance path, the way `rogen where <file>` prints it: `require(ReplicatedStorage.Shared.features.shop.ShopNetwork)`. Shared code can't require what only one place has: the other places don't have it.

Code meets in three ways: a direct `require` by default; a registry in `game/` when one owner has many contributors (the one `ProcessReceipt` handler, with the features registering their product handlers), so `game/` never requires a feature; a typed signal the emitter exports, for a fact others react to. Never a string-keyed event bus.

`mise run check` builds, type-checks and tests every place; Studio commands name one: `mise run dev lobby`, `mise run sync lobby`. luau-lsp types each place against its own sourcemap in the check; your editor types one place at a time, `game`, from `sourcemap.json` at the root: to switch, change the place in `luau-lsp.sourcemap.generatorCommand` in `.vscode/settings.json` and run `mise run generate`. Name each file after what it holds: `InventoryService.luau`.

Rogen's own section below applies here too; the configs are at the root. Run `rogen check` and `rogen write` from the root with no path, which covers every place, or name a place's config to work on one: `rogen write lobby`, `rogen check lobby`. `rogen where <path>` works on shared and place files alike.

A new place: copy `projects/lobby` to `projects/<place>` and `lobby.rogen.json` to `<place>.rogen.json`, and in the copy change `name` and the place's source path. `mise run check` then builds and tests it too.
