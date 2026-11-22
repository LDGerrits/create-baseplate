---
title: The project
description: Where code goes, adding a feature, and the rules the code follows.
---

## Where code goes

Each feature is a folder, `src/features/<feature>/`. Inside it, the folder a file sits in decides where it runs:

- `server/`: only on the server, never sent to clients.
- `client/`: only on the player's device.
- `shared/`: both. It can't import server or client code.

`src/app/` holds the entry scripts, which start Flamework, and the root of the UI. The example feature, `src/features/clicker`, shows the whole shape.

## Adding a feature

1. Network events in `shared/<feature>-network.ts`.
2. A Flamework service in `server/` and, if the client takes part, a controller in `client/`. Import each in the matching `main` file.
3. UI as a React component in `client/`, with a story.
4. A spec for the service, and an end-to-end test for each request a client sends.

## The rules

- **Never trust the client.** Clients ask; services decide, and check every request. `mise run check` fails on a client-to-server event or function the server takes without middleware: give it `rateLimit` from `src/network/server/rate-limit.ts`, which drops a player's calls beyond a number a second, or mark its handler `// trusts-client: <why>`. The limit is a floor; the service still checks the request.
- **Services own server state.** Other code calls their methods.
- **Controllers run the client side** and keep what the UI shows.
