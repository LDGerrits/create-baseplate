## Where code goes

This game has several places: each place is a folder in `projects/`, and the code they share is `projects/common/src`.

- `projects/common/src/features/<feature>/`: one folder per feature that several places use; `mise run feature <name>` starts one.
- `projects/<place>/src/`: what only that place has. Its `app/` holds the entry scripts: `app/server/main.server.ts` and `app/client/main.client.ts` import every service and controller the place uses, shared ones included, and start Flamework. A feature only one place uses goes in `projects/<place>/src/features/`.
- The shared code's specs and end-to-end tests run in the `game` place only (its `tsconfig.game.json` compiles them; the others exclude them), so each runs once. Put a test of shared code in `projects/game/tests/e2e/`, and a test of one place's own code in that place.
- Each place has its own `default.rogen.json` (`sourcePaths` `["../common/src", "src"]`), `tsconfig.json`, `tests/e2e/` and forge config.

Inside a feature, the folder a file sits in decides where it runs:

- `server/`: only on the server, never sent to clients. Rules, validation and secrets go here.
- `client/`: only on the player's device.
- `shared/`: both. It can't import `server/` or `client/` code; ESLint enforces the sides.

`mise run check` builds, checks and tests every place; `mise run dev` names the place it serves: `mise run dev lobby`. Files are kebab-case, named after what they hold: `inventory-service.ts`.

Each place compiles from its own `tsconfig.<place>.json` at the root (the place's `tsconfig.json` extends it, for editors) into `out/<place>/`; `mise run check` also type-checks the shared code on its own. `mise run test:engine` runs each place's specs in turn, in the one test place set in `.env`.
