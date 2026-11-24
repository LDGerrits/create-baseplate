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

Agents don't publish: a hook stops them running `mise run publish`, and they tell you when a change is ready.

## Publish from CI

Every published version should come from a commit, so you can publish any of them again. `.github/workflows/publish.yml` publishes to three places, each in its own experience:

| Target | When | For |
| --- | --- | --- |
| dev | each push to main, once CI passes on it | the latest code, to try together |
| stable | a version tag, `git tag v1.2.0 && git push origin v1.2.0` | playtests |
| prod | the same tag, after stable, once someone approves it | the game players join |

Set up each target you use:

1. Create the experience and its places, and publish them once from Studio.
2. Under **Settings > Environments**, add an environment named after the target (`dev`, `stable`, `prod`) with the secret `ROBLOX_PUBLISH_API_KEY`: a key with `universe-places:write` on that experience only.
3. Under **Settings > Secrets and variables > Actions > Variables**, add `ROBLOX_<TARGET>_UNIVERSE_ID` and `ROBLOX_<TARGET>_PLACE_ID`, such as `ROBLOX_DEV_PLACE_ID`.
4. For prod, give the environment **required reviewers**, so a tag waits for someone to approve it; without them, every tag goes live. Limit its deployments to tags matching `v*`.

A target without its place variable shows as skipped. Never edit dev, stable or prod in Studio: the next publish replaces the place with what's in git, and the edit is lost. Edit the world in your own place and sync it back to `world/` (see [World and Studio](/world-and-studio/)).
