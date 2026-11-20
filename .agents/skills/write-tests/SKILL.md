---
name: write-tests
description: Write or run this game's tests. Use when adding a spec, an end-to-end test or an engine spec, when a test fails, or when choosing between ree and real Studio.
---

# Write tests

Every test runs in one of two engines:

- **ree**, an emulated Roblox engine: `mise run test`, about a second, offline. `mise run check` and the Stop hook run it.
- **A real Roblox engine** through jest-roblox: `mise run test:engine`, about twenty seconds, in Studio or Open Cloud.

When the two disagree, the real engine is right. ree lets a call to a member it doesn't emulate return nothing, so `mise run test` fails any run that reaches one and names the member: prove that behaviour in an engine spec instead.

## Pick the kind of test

| What you test                                                                                     | Kind                                         | File                             |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------- |
| Rules, formulas, validation                                                                       | Spec                                         | `<name>.spec.ts` beside the code |
| A service's decisions                                                                             | Spec, with fakes for its platform interfaces | `<feature>-service.spec.ts`      |
| A request from a client, through the real server and remotes                                      | End-to-end test                              | `tests/e2e/<feature>.luau`       |
| Collisions, physics beyond free fall, Humanoids (health, `Died`, movement), real DataStore limits | Engine spec                                  | `<name>.engine.spec.ts`          |
| How UI looks                                                                                      | A story, not a test                          | see the `build-ui` skill         |

## Specs

Jest tests written with `@rbxts/jest-globals`. Copy `src/features/clicker/shared/clicker-rules.spec.ts`.

Test a service through its public methods. Construct it yourself with `new`, passing a fake for each platform interface its constructor asks for, as `src/features/clicker/server/clicker-service.spec.ts` does with `FakeClock`. Start a fake clock at 0: at large times, float rounding moves values across a cooldown's boundary.

## End-to-end tests

A ree harness in `tests/e2e/<feature>.luau`, run with the server and one player's client in one process. Copy `tests/e2e/clicker.luau`:

- `Server` boots the game's own server script; keep its `bootServer` as it is.
- `Client` waits for the server to start, then talks to it through the game's remotes, the way the real client would, and `assert`s on what comes back.
- The test passes when the client prints `@done`. A failed `assert`, or any script error on either side, fails it.

## Engine specs

Name the file `<name>.engine.spec.ts`; ree skips it. After writing or changing one, run `mise run test:engine` yourself.

jest-roblox uses Roblox Studio when it finds it, and Open Cloud otherwise. From WSL it can't find Studio: set `JEST_ROBLOX_STUDIO_PATH` to `RobloxStudioBeta.exe` and `JEST_ROBLOX_PLUGINS_DIR` to Studio's `Plugins` folder, both as `/mnt/c/...` paths. Open Cloud needs `ROBLOX_OPEN_CLOUD_API_KEY`, `ROBLOX_UNIVERSE_ID` and `ROBLOX_PLACE_ID`. `node_modules/@isentinel/jest-roblox/README.md` covers both.

## When a test fails

`mise run test` prints each failing run's output, with the spec and line. Fix the code or the test until it passes, or tell the user why it stays failing. A test that fails only in ree while it passes in `mise run test:engine` is an emulation gap: make it an engine spec and tell the user.
