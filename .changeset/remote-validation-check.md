---
"create-baseplate": minor
---

`mise run check` now fails when the server takes a client-to-server event or function without middleware, naming the remote and its file: missing server-side checks on remotes are how Roblox games get exploited, and Flamework's types allow them. The game ships `rateLimit` and `rateLimitFunction` in `src/network/server/rate-limit.ts` (`projects/common/src/network/` with `--places multi`), middleware that drops a player's calls beyond a number a second; the clicker example uses it, and its service still applies its own cooldown. A remote that any client may send freely is marked `// trusts-client: <why>` on the line above its handler.
