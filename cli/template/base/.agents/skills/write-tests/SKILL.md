---
name: write-tests
description: Write or run this game's tests. Use when adding a spec, an end-to-end test or an engine spec, when a test fails, or when choosing between ree and real Studio.
---

# Write tests

Every test runs in one of two engines:

- **ree**, an emulated Roblox engine: `mise run test`, about a second, offline. `mise run check` runs it.
- **A real Roblox engine** through jest-roblox: `mise run test:engine`, about twenty seconds, in Studio or Open Cloud.

When the two disagree, the real engine is right. ree lets a call to a member it doesn't emulate return nothing, so `mise run test` fails any run that reaches one and names the member and where the game first used it: prove that behaviour in an engine spec instead.

AGENTS.md says which kind of test fits what you test. How to write each:

## Specs

Jest tests written with `@rbxts/jest-globals`. Copy `src/features/clicker/server/clicker-service.spec.ts`: it constructs the service with `new` and calls its public methods.

When a decision depends on the time, take `now` as a parameter that defaults to `os.clock()`, as `ClickerService.click` does, so a spec passes its own times instead of waiting.

## End-to-end tests

A ree harness in `tests/e2e/<feature>.luau`, run with the server and one player's client in one process. Copy `tests/e2e/clicker.luau`:

- `Server` boots the game's own server script; keep its `bootServer` as it is.
- `Client` talks to the server through the game's remotes, the way the real client would, and `assert`s on what comes back. Wait for what you expect with `waitFor`, not a fixed `task.wait`.
- The test passes when the client prints `@done`. A failed `assert`, or any script error on either side, fails it.
- To test what the player sees, start the client's own UI, as `tests/e2e/clicker-ui.luau` does: the client can't run a script's source in ree, so it calls `start()` from `src/app/client/start.tsx`, which `main.client.tsx` runs in the game, and reads the instances it mounts.

## Engine specs

Name the file `<name>.engine.spec.ts`; ree skips it. After writing or changing one, run `mise run test:engine` yourself.

jest-roblox uses Roblox Studio when it finds it, and Open Cloud otherwise. From WSL it can't find Studio: set `JEST_ROBLOX_STUDIO_PATH` and `JEST_ROBLOX_PLUGINS_DIR` in `.env` (see `.env.example`). Open Cloud needs the `ROBLOX_*` values there. `node_modules/@isentinel/jest-roblox/README.md` covers both.

## When a test fails

`mise run test` prints each failing run's output, with the spec and line. Fix the code or the test until it passes, or tell the user why it stays failing. A test that fails only in ree while it passes in `mise run test:engine` is an emulation gap: make it an engine spec and tell the user.
