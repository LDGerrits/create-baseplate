---
name: add-feature
description: Add a feature to the game: a service, its remotes, a controller, UI and tests. Use when asked for a new mechanic, system or screen, such as a shop, a quest or a daily reward.
---

# Add a feature

Run `mise run feature <name>` with the name in lowercase letters and digits (`dailyreward`: it is part of a Roblox path, so no hyphens). In a multi-place game the feature goes in the shared code and every place lists it; `mise run feature <name> <place>` keeps it to one place. It writes, under `features/<name>/`:

- `shared/<Name>Network.luau`: the remotes between client and server, made with Remo, each with its argument types and, for what clients send, a `t` validator.
- `server/<Name>Service.luau`: the service, which connects to the remotes, and its spec beside it.
- `client/<Name>Controller.luau`: the controller.

and adds the service and the controller to the lists in `app/server/Main.server.luau` and `app/client/Start.luau`, or they never start. Then make it do something:

1. **Rules first.** Put the rules in the service, as functions a spec can call: ownership, cost, cooldowns, limits. The clients ask; nothing the client sends is true until the service checks it. Write the spec for each rule before the code that uses it (`write-tests` skill).
2. **Remotes.** Add them to `shared/<Name>Network.luau`. Give each argument a client sends a `t` validator, and each client-to-server remote a `throttleMiddleware` that fits the action (a purchase is one a second, not twenty).
3. **Controller.** Keep what the UI shows, and let `App.luau` subscribe to it, as `ClickerController` does.
4. **UI.** A component in `client/` with a story, and look at its picture (`mise run ui --filter <name>`): text cut off, overlap, the empty state.
5. **End to end.** A request from the client through the real server and remotes in `tests/e2e/<name>.luau`, copied from `tests/e2e/clicker.luau`.
6. **`mise run check`** until it passes.

Where a feature keeps player data or state, follow the section in `AGENTS.md` for the game's data or state library.
