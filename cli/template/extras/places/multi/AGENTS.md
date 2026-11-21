## Where code goes

This game has several places, laid out as Rogen does for roblox-ts: each place is a folder in `projects/`, and the code they share is `projects/common/src`.

- `projects/common/src/features/<feature>/`: one folder per feature that several places use; `features/clicker` is the example to copy.
- `projects/<place>/src/`: what only that place has. Its `app/` holds the entry scripts: `app/server/main.server.ts` and `app/client/main.client.tsx` import every service and controller the place uses, shared ones included, and start Flamework; `app/client/app.tsx` is the root of its UI. A feature only one place uses goes in `projects/<place>/src/features/`.
- Each place has its own `default.rogen.json` (`sourcePaths` `["../common/src", "src"]`), `tsconfig.json`, `world/` (its map, typed in its own `src/world.d.ts`), `tests/e2e/` and forge config. Shared code can't use one place's world types.

Inside a feature, the folder a file sits in decides where it runs:

- `server/`: only on the server, never sent to clients. Rules, validation and secrets go here.
- `client/`: only on the player's device.
- `shared/`: both. It can't import `server/` or `client/` code; ESLint enforces the sides.

`mise run check` builds, checks and tests every place; Studio commands name one: `mise run dev lobby`, `mise run sync lobby`. Files are kebab-case, named after what they hold: `inventory-service.ts`.

Each place compiles from its own `tsconfig.<place>.json` at the root (the place's `tsconfig.json` extends it, for editors) into `out/<place>/`; `mise run check` also type-checks the shared code on its own. `mise run test:engine` runs each place's specs in turn, in the one test place set in `.env`.
