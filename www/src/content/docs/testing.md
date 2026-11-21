---
title: Testing
description: Specs, end-to-end tests and engine specs, offline in ree or in real Roblox.
---

`mise run test` runs the tests offline in ree, an emulated Roblox engine, in about a second. `mise run check` runs them too.

| What you test                                          | Kind            | File                             |
| ------------------------------------------------------ | --------------- | -------------------------------- |
| A service's rules and decisions                        | Spec            | `<name>.spec.ts` beside the code |
| A client's request through the real server and remotes | End-to-end test | `tests/e2e/<feature>.luau`       |
| Characters, physics, collisions, real DataStore limits | Engine spec     | `<name>.engine.spec.ts`          |

Engine specs run in real Roblox, in Studio or through Open Cloud, with `mise run test:engine`. When a test reaches something ree doesn't emulate, it fails and names it, so that behaviour moves to an engine spec.
