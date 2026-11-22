---
title: Testing
description: Specs, end-to-end tests and engine specs, offline in ree or in real Roblox.
---

`mise run test` runs the tests offline in ree, an emulated Roblox engine, in a few seconds. `mise run check` runs them too.

| What you test | Kind | File |
| --- | --- | --- |
| A service's rules and decisions | Spec | `<name>.spec.ts` beside the code (Luau: `<Name>.spec.luau`) |
| A client's request through the real server and remotes | End-to-end test | `tests/e2e/<feature>.luau`, in either language |
| Characters, physics, collisions, real DataStore limits | Engine spec | `<name>.engine.spec.ts` (Luau: `<Name>.engine.spec.luau`) |

`mise run test:engine` runs every spec, engine specs included, in real Roblox: in Studio, or through Open Cloud. When a test reaches something ree doesn't emulate, it fails and names it, so that behaviour moves to an engine spec.
