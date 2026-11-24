---
title: Environment variables
description: Every key and path a game reads, which command needs it, and the CI secrets.
---

None of these is needed for `mise run check`, nor for agents in the cloud, which set themselves up with `.agents/hooks/cloud-setup.sh` (see [How agents work in it](/agents/)). Copy `.env.example` to `.env` and fill in what you use; git ignores `.env`, and mise loads it only into the tasks that use it, so other tools never see your keys.

## In `.env`

| Variable | Used by | What |
| --- | --- | --- |
| `ROBLOX_OPEN_CLOUD_API_KEY` | `mise run test:engine` | An Open Cloud key with `universe-places:write` and `universe.place.luau-execution-session:write`, on an experience made only for tests. |
| `ROBLOX_UNIVERSE_ID` | `mise run test:engine` | That test experience's ID. |
| `ROBLOX_PLACE_ID` | `mise run test:engine` | The place the tests upload to and run in. |
| `JEST_ROBLOX_STUDIO_PATH` | `mise run test:engine` | WSL only: Windows Studio's `RobloxStudioBeta.exe`, as a `/mnt/c/...` path. |
| `JEST_ROBLOX_PLUGINS_DIR` | `mise run test:engine` | WSL only: Windows Studio's plugins folder. |
| `RUR_ROBLOX_CONTENT` | `mise run ui` | Studio's `content` folder, for its fonts, where rur can't find Studio by itself (macOS and Linux without Studio). |
| `ROBLOX_PUBLISH_API_KEY` | `mise run publish` | A key with `universe-places:write` on the experience you publish to. Keep it apart from the test key. |
| `ROBLOX_PUBLISH_UNIVERSE_ID` | `mise run publish` | That experience's ID. |
| `ROBLOX_PUBLISH_PLACE_ID` | `mise run publish` | The place's ID; in a multi-place game, each place's: `lobby=123,game=456`. |
| `ASPHALT_API_KEY` | `mise run assets` | With the assets add-on: a key with `asset:read` and `asset:write`, owned by the creator in `asphalt.toml`. |

## In GitHub

Under **Settings > Secrets and variables > Actions** of the game's repository:

| Name | Kind | What |
| --- | --- | --- |
| `ROBLOX_OPEN_CLOUD_API_KEY` | secret | Runs every spec, engine specs included, in a real Roblox server. Without it and the two variables, that job shows as skipped. |
| `ROBLOX_UNIVERSE_ID`, `ROBLOX_PLACE_ID` | variables | The test experience and place, as above. |
| `ROBLOX_PUBLISH_API_KEY` | environment secret | In each of the environments `dev`, `stable` and `prod`: the key `.github/workflows/publish.yml` publishes that target with (see [Publishing](/publishing/)). |
| `ROBLOX_<TARGET>_UNIVERSE_ID`, `ROBLOX_<TARGET>_PLACE_ID` | variables | Each target's experience and place, such as `ROBLOX_DEV_PLACE_ID`. Without its place variable, a target's job shows as skipped. |
| `BOT_APP_CLIENT_ID`, `BOT_APP_PRIVATE_KEY` | secrets | A GitHub App with Contents read and write on the repository. When Renovate updates a tool or create-baseplate, `.github/workflows/renovate-fixups.yml` pushes the new `mise.lock` or the synced agent files as this app, so CI runs again and the update can merge. |
