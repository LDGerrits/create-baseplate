---
title: The project
description: Where code goes, adding a feature, and the rules the code follows.
---

This page describes a TypeScript game. A Luau game has the same shape in Luau's names (`src/features/<feature>/server/`, and the same four layers), with plain modules for services and controllers and remotes declared with Remo: see [Luau games](/luau/).

## Where code goes

Code in `src/` sits in four layers, and imports only go down:

- `app/`: the entry scripts: `server/main.server.ts` and `client/main.client.ts` start Flamework. It may import every layer.
- `features/<feature>/`: what the game could ship without, such as a shop or a season. `mise run feature <name>` writes the first. It may import `game`, `platform` and other features, but never in a cycle between feature folders.
- `game/<system>/`: the always-on systems: the one receipt handler, the player's saved data, what features build on, concepts several features write. It never imports a feature or `app`.
- `platform/<module>/`: game-agnostic Roblox code that would move unchanged to another game. It imports none of the others.

To tell a feature from a system, delete the folder: if the game still works it was a feature. The children of `game/` and `platform/` are named folders, with no loose files and no `util(s)`, `lib(s)`, `helper(s)`, `common` or `misc`. Inside a feature or module, and in `app/`, the folder a file sits in decides where it runs:

- `server/`: only on the server, never sent to clients.
- `client/`: only on the player's device.
- `shared/`: both. It can't import server or client code.

Side folders sit only at `app/<side>/` and `<layer>/<module>/<side>/`. `mise run check` fails on anything else: ESLint on an import that goes up, the source check on a cycle between features, a file outside a side folder or a folder under `src/` that is no layer, each with the next move in its message.

Code meets in three ways: a direct import by default; a registry in `game/` when one owner has many contributors (the one `ProcessReceipt` handler, with the features registering their product handlers), so `game/` never imports a feature; and a typed signal the emitter exports, for a fact others react to. Never a string-keyed event bus.

## Adding a feature

`mise run feature <name>` writes the first two steps, and the service's spec: the network file, a service, a controller, and their imports in the entry scripts. In a multi-place game the feature goes in the shared code; `mise run feature <name> <place>` keeps it to one place. The `add-feature` skill walks an agent through the rest.

1. Network events in `shared/<feature>-network.ts`.
2. A Flamework service in `server/` and, if the client takes part, a controller in `client/`. Import each in the matching `main` file.
3. UI as a React component in `client/`, with a story.
4. A spec for the service, and an end-to-end test for each request a client sends.

## The rules

- **Never trust the client.** Clients ask; services decide, and check every request. `mise run check` fails on a client-to-server event or function the server takes without middleware: give it Flamework middleware that rate-limits it, or mark its handler `// trusts-client: <why>`. A rate limit is a floor; the service still checks the request.
- **Services own server state.** Other code calls their methods.
- **Controllers run the client side** and keep what the UI shows.
