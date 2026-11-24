---
title: The project
description: Where code goes, adding a feature, and the rules the code follows.
---

This page describes a TypeScript game. A Luau game has the same shape in Luau's names (`src/features/<feature>/server/`), with plain modules for services and controllers and remotes declared with Remo: see [Luau games](/luau/).

## Where code goes

Each feature is a folder, `src/features/<feature>/`. Inside it, the folder a file sits in decides where it runs:

- `server/`: only on the server, never sent to clients.
- `client/`: only on the player's device.
- `shared/`: both. It can't import server or client code.

`src/app/` holds the entry scripts, `server/main.server.ts` and `client/main.client.ts`, which start Flamework. A new game has no features: `mise run feature <name>` writes the first.

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
