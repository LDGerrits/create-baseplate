---
"create-baseplate": minor
---

Luau games declare their remotes with Remo instead of the template's own `Remote`, `Serve` and `RateLimit` modules: each feature's remotes sit in a Remo namespace, with a `t` validator for what clients send and `throttleMiddleware` on client-to-server remotes. The check still fails on `OnServerEvent` or `OnServerInvoke` in the game's own code.
