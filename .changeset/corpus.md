---
"create-baseplate": patch
---

A TypeScript game's `mise run feature` writes an end-to-end test that StyLua accepts for long feature names too; the e2e check reads a network's client-to-server type when it's a `type` alias; a network the server only broadcasts on may declare an empty interface for what clients send, as Flamework needs; and the Luau `build-ui` skill's mounting code is formatted as StyLua writes it. Each was found by checking a corpus of correct game code against the rules.
