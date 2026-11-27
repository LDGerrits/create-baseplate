---
name: write-tests
description: Write or run this game's tests. Use when adding a spec, an end-to-end test or an engine spec, when a test fails, or when choosing between ree and real Studio.
---

# Write tests

Every test runs in one of two engines:

- **ree**, an emulated Roblox engine: `mise run test`, a few seconds, offline. `mise run check` runs it.
  `mise run test -- <regex>` runs only the specs and end-to-end tests whose path matches; `mise run test -- -t <regex>` runs the tests whose name matches.
- **A real Roblox engine** through jest-roblox: `mise run test:engine`, about twenty seconds, in Studio or Open Cloud.

When the two disagree, the real engine is right. ree lets a call to a member it doesn't emulate return nothing, so `mise run test` fails any run that reaches one and names the member and where the game first used it: prove that behaviour in an engine spec instead.

AGENTS.md says which kind of test fits what you test. How to write each:

## Specs

Jest tests written with `@rbxts/jest-globals`, beside the code in any layer. `mise run feature <name>` writes one to start from, `<name>-service.spec.ts`: it constructs the service with `new` and calls its public methods.

When a decision depends on the time, take `now` as a parameter, so a spec passes its own times instead of waiting. Default it to `os.time()` for anything saved or compared across servers (a daily reward, a cooldown that outlives a session): `os.clock()` counts from each server's own start and means nothing on another. Default to `os.clock()` only for durations within one server.

## End-to-end tests

A ree harness in `tests/e2e/<feature>.luau`, run with the server and one player's client in one process; `scripts/test.ts` runs every file there. `mise run feature <name>` writes one that asks the new feature for its value through its remotes, as a client would: add a test there for each request a client sends, and copy it for a feature made by hand.

- `Server` boots the game's own server script; keep `bootServer` as it is. A test of the world can also do its checks in `Server`, and print `@done` there.
- `Client` talks to the server through the game's remotes, the way the real client would, and `assert`s on what comes back. Wait for what you expect with `waitFor`, not a fixed `task.wait`.
- The test passes when the client prints `@done`. A failed `assert`, or any script error on either side, fails it.
- ree spawns no character and never fires `Touched` or other physics: a test that waits for them times out. Call the handler a touch would call from a spec, and test the touch itself in an engine spec.
- The client can't run a script's source in ree, so a test of what the player sees can't boot `main.client.ts`: test the controller's logic in a spec, and look at the UI through its stories.

## Engine specs

Name the file `<name>.engine.spec.ts`; ree skips it. After writing or changing one, run `mise run test:engine` yourself.

jest-roblox uses Roblox Studio when it finds it, and Open Cloud otherwise. From WSL, `mise run test:engine` points it at the newest Windows Studio; `JEST_ROBLOX_STUDIO_PATH` and `JEST_ROBLOX_PLUGINS_DIR` in `.env` pick another. Open Cloud needs the `ROBLOX_*` values there. `node_modules/@isentinel/jest-roblox/README.md` covers both.

## When a test fails

`mise run test` prints each failing run's output, with the spec and line. Fix the code or the test until it passes, or tell the user why it stays failing. A test that fails only in ree while it passes in `mise run test:engine` is an emulation gap: make it an engine spec and tell the user.
