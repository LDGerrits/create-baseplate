## Where code goes

This game has several places: each place is a folder in `projects/`, and the code they share is `projects/common/src`.

- `projects/common/src/`: the layers' folders for what several places use: `features/<feature>/` (`mise run feature <name>` starts one), `game/<system>/` and `platform/<module>/`.
- `projects/<place>/src/`: what only that place has. Its `app/` holds the entry scripts: `app/server/main.server.ts` and `app/client/main.client.ts` import every service and controller the place uses, shared ones included, and start Flamework. Its own features, systems and modules sit beside `app/`, in the same layers.
- The shared code's specs and end-to-end tests run in the `game` place only (its `tsconfig.game.json` compiles them; the others exclude them), so each runs once. Put a test of shared code in `projects/game/tests/e2e/`, and a test of one place's own code in that place.
- Each place has its own `default.rogen.json` (`sourcePaths` `["../common/src", "src"]`), `tsconfig.json`, `tests/e2e/` and forge config.

The four layers sit in each source root, `projects/common/src` and `projects/<place>/src`, and imports only go down: `app`, then `features`, then `game`, then `platform`. A place may import the shared code; the shared code never imports a place, and a place never imports another. The check fails on any of them.

- `app/`: a place's entry scripts only, so only in `projects/<place>/src/app/`. It may import every layer.
- `features/<feature>/`: what the game could ship without. It may import `game`, `platform` and other features, never in a cycle between features.
- `game/<system>/`: the always-on systems and what features build on; it never imports a feature or `app`.
- `platform/<module>/`: game-agnostic code that would move unchanged to another game; it imports none of the others.

A feature or a system? Delete the folder: if the game still works, it's a feature; if other code breaks, it belongs in `game/`. The children of `game/` and `platform/` are folders named for what they hold: no loose files there, and no `util(s)`, `lib(s)`, `helper(s)`, `common` or `misc`.

Inside a feature or module, and in `app/`, the folder a file sits in decides where it runs:

- `server/`: only on the server, never sent to clients. Rules, validation and secrets go here.
- `client/`: only on the player's device.
- `shared/`: both. It can't import `server/` or `client/` code; ESLint enforces the sides.

Code meets in three ways: a direct import by default; a registry in `game/` when one owner has many contributors (the one `ProcessReceipt` handler, with the features registering their product handlers), so `game/` never imports a feature; a typed signal the emitter exports, for a fact others react to. Never a string-keyed event bus.

Side folders sit only at `app/<side>/` and `<layer>/<module>/<side>/`, and a file outside one isn't placed in the game.

`mise run check` builds, checks and tests every place; `mise run dev` names the place it serves: `mise run dev lobby`. Files are kebab-case, named after what they hold: `inventory-service.ts`.

Each place compiles from its own `tsconfig.<place>.json` at the root (the place's `tsconfig.json` extends it, for editors) into `out/<place>/`; `mise run check` also type-checks the shared code on its own. `mise run test:engine` runs each place's specs in turn, in the one test place set in `.env`.
