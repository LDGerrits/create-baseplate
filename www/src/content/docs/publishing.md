---
title: Publishing
description: Build the place file and publish it to Roblox, from Studio or the command line.
---

This page is about a game Rojo manages in full, the default. A game created with `--managed partial` has no `mise run publish` and no publish workflow: you publish from Studio, where the place and its world live, after `mise run dev` has synced the code into it.

## Build the place

```sh
mise run build
```

compiles the code and builds `build/game.rbxl`: the code and the world, as Studio would open it. In a multi-place game, each place builds its own, in `projects/<place>/build/game.rbxl`.

With the release add-on (`--release darklua`), `mise run publish` publishes the release build instead, which you can also build alone:

```sh
mise run release
```

It builds `build/release.rbxl` from code that Darklua has minified and stripped, then runs the tests on that build, so what you publish is what was tested.

## Publish from Studio

Open the place file in Studio and use **File > Publish to Roblox**. That's the simplest way for the first publish, which also creates the experience.

## Publish from the command line

`mise run publish` builds the place and publishes it through Open Cloud. Create a key at [create.roblox.com/dashboard/credentials](https://create.roblox.com/dashboard/credentials) with `universe-places:write` on the experience you publish to, and set it in `.env` with the experience and the place:

```sh
ROBLOX_PUBLISH_API_KEY=...
ROBLOX_PUBLISH_UNIVERSE_ID=<experience ID>
ROBLOX_PUBLISH_PLACE_ID=<place ID>
```

In a multi-place game, `ROBLOX_PUBLISH_PLACE_ID` names each place's ID: `lobby=123,game=456`. With the release add-on, `mise run publish` builds and publishes the release build.

Keep this key apart from the test key the CI uses (`ROBLOX_OPEN_CLOUD_API_KEY`, see [environment variables](/environment/)): a key reaches every place of its experience, and the test key should only reach an experience made for tests.

Agents don't publish: a hook stops them running `mise run publish` or publishing through Studio's MCP server, and they tell you when a change is ready. Open Cloud's place publishing doesn't update unions, `SurfaceAppearance`, wrap layers or editable images and meshes, so the check warns about each: after changing one, publish from Studio.

## Read the errors of a version

After a version reaches the dev experience, `mise run errors -- <version>` lists the errors first seen in that place version or later, most frequent first, with their stack traces; the version number is in the publish job's log (`Published ... as version 42`). `mise run errors -- --hours 6` lists those first seen in the last hours instead, and `--json` prints them as JSON. Run it again after a fix: the count of a fixed error stops growing. It reads from Roblox's [Error Reporting](https://create.roblox.com/docs/cloud/guides/error-reporting) and [Analytics](https://create.roblox.com/docs/cloud/guides/analytics) APIs with a key of its own, `ROBLOX_ERRORS_API_KEY`, which holds only `universe.analytics:read`: it can't publish or change anything, so an agent may run it. Roblox's data lags by a few minutes.

## Publish from CI

Every published version should come from a commit, so you can publish any of them again. `.github/workflows/publish.yml` publishes to up to three targets, each in its own experience:

| Target | When | For |
| --- | --- | --- |
| dev | each push to main, once CI passes on it | the latest code, to try together |
| stable (optional) | a version tag, `git tag v1.2.0 && git push origin v1.2.0` | testers playing the release before players do |
| prod | the same tag, after stable if you use it, once someone approves it | the game players join |

A tag publishes only a commit whose CI passed on main: the workflow waits for that commit's run if it is still going, and stops when there is none or it failed. Tag a commit that has merged to main.

Each publish builds the place in a step of its own (`mise run publish:build`) and uploads it in the next (`mise run --skip-deps publish`), the only step that gets the key: the compiler and the other build tools never run with it.

Most games need only dev and prod. Add stable when other people test releases, such as a QA group or trusted players: they play the exact build prod will get, while dev keeps moving. Each experience has its own DataStores, and its own developer products, game passes and badges, with their own IDs, so every target is one more set of these to keep in step.

Set up each target you use:

1. Create the experience and its places, and publish them once from Studio.
2. Under **Settings > Environments**, add an environment named after the target (`dev`, `stable`, `prod`) with the secret `ROBLOX_PUBLISH_API_KEY`: a key with `universe-places:write` on that experience only. Prod's key also needs `universe-datastores.control:snapshot`: before it publishes, the workflow snapshots the DataStores (`scripts/snapshot.ts`), which costs no storage of yours and keeps every player's data as it stood restorable for 30 days if the release corrupts it.
3. Under **Settings > Secrets and variables > Actions > Variables**, add `ROBLOX_<TARGET>_UNIVERSE_ID` and `ROBLOX_<TARGET>_PLACE_ID`, such as `ROBLOX_DEV_PLACE_ID`.
4. For prod, give the environment **required reviewers**, so a tag waits for someone to approve it; without them, every tag goes live. Limit its deployments to tags matching `v*`.

A target without its place variable shows as skipped. Never edit dev, stable or prod in Studio: the next publish replaces the place with what's in git, and the edit is lost. Edit the world in your own place and sync it back to `world/` (see [World and Studio](/world-and-studio/)).
