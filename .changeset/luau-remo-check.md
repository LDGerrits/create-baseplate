---
"create-baseplate": minor
---

A Luau game's check fails on a Remo remote that clients send (`Remo.ClientToServer` or `Remo.ServerAsync`) declared without `throttleMiddleware`, or without `t` validators when it takes arguments, as a TypeScript game's check does for Flamework's remotes. Mark one any client may send freely with `-- trusts-client: <why>` on the line above it.
