---
name: add-feature
description: Add a feature to the game: a service, its network events, a controller, UI and tests. Use when asked for a new mechanic, system or screen, such as a shop, a quest or a daily reward.
---

# Add a feature

Is it a feature? If the game could ship without it, yes; if other code would break without it (currency, the player's data, the one receipt handler), it's a system: make `game/<system>/` by hand with `server/`, `client/` and `shared/` as it needs them, and let features import it. `game/` never imports a feature: for many contributors to one owner, have the feature register with a registry in `game/`; for a fact others react to, export a typed signal from the emitter.

Run `mise run feature <name>` with the name in kebab-case (`daily-reward`). In a multi-place game the feature goes in the shared code and every place imports it; `mise run feature <name> <place>` keeps it to one place. It writes, under `features/<name>/`:

- `shared/<name>-network.ts`: the events between client and server.
- `server/<name>-service.ts`: the service, and its spec beside it. Its one event goes through `rateLimit` middleware in `createServer`.
- `client/<name>-controller.ts`: the controller.

and imports the service and the controller in `app/server/main.server.ts` and `app/client/main.client.ts`, which Flamework needs to start them. Then make it do something:

1. **Rules first.** Put the rules in the service, as methods a spec can call: ownership, cost, cooldowns, limits. The clients ask; nothing the client sends is true until the service checks it. Write the spec for each rule before the code that uses it (`write-tests` skill).
2. **Network.** Add events to `shared/<name>-network.ts`. Give each client-to-server event `rateLimit(<seconds>)` in `createServer`'s `middleware` (a function `rateLimitFunction`), from `src/platform/network/server/rate-limit.ts`, at a rate that fits the action: a purchase is one a second, not twenty.
3. **Controller.** Keep what the UI shows, and let the root component subscribe to it (`.agents/skills/build-ui/SKILL.md`).
4. **UI.** A component in `client/` with a story, and look at its picture (`mise run ui -- --filter <name>`): text cut off, overlap, the empty state.
5. **End to end.** A request from the client through the real server and remotes in `tests/e2e/<name>.luau`, from the harness in the `write-tests` skill.
6. **`mise run check`** until it passes.

Where a feature keeps player data or state, follow the section in `AGENTS.md` for the game's data or state library.
