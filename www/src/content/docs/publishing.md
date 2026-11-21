---
title: Publishing
description: Build the place file and publish it to Roblox, from Studio or the command line.
---

## Build the place

```sh
mise run build
```

compiles the code and builds `build/game.rbxl`: the code and the world, as Studio would open it. In a multi-place game, each place builds its own, in `projects/<place>/build/game.rbxl`.

With the release add-on (`--release darklua`), publish the release build instead:

```sh
mise run release
```

It builds `build/release.rbxl` from code that Darklua has minified and stripped, then runs the tests on that build, so what you publish is what was tested.

## Publish from Studio

Open the place file in Studio and use **File > Publish to Roblox**. That's the simplest way for the first publish, which also creates the experience.

## Publish from the command line

Rojo uploads a place through Open Cloud. Create an API key at [create.roblox.com/dashboard/credentials](https://create.roblox.com/dashboard/credentials) with the `universe-places:write` scope on the experience you publish to, then:

```sh
mise x -- rojo upload game.project.json --api_key "$KEY" --universe_id <experience ID> --asset_id <place ID>
```

In a multi-place game, run it in each place's folder, `projects/<place>/`. For a release build, upload `release.project.json` instead.

Keep this key apart from the test key the CI uses (`ROBLOX_OPEN_CLOUD_API_KEY`, see [environment variables](/environment/)): a key reaches every place of its experience, and the test key should only reach an experience made for tests.
