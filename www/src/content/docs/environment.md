---
title: Environment variables
description: Every key and path a game reads, which command needs it, and the CI secrets.
---

None of these is needed for `mise run check`, nor for agents in the cloud, which set themselves up with `.agents/hooks/cloud-setup.sh` (see [How agents work in it](/agents/)). Copy `.env.example` to `.env` and fill in what you use; git ignores `.env`. Only the tasks that use it read it, and each passes on only its own variables (`scripts/with-env.ts`), so the tests never see the publish key, nor publishing the test key. That keeps keys from tools that don't need them, not from code run inside a task. A variable already set in the environment, as in CI, wins over `.env`.

## In `.env`

| Variable | Used by | What |
| --- | --- | --- |
| `ROBLOX_OPEN_CLOUD_API_KEY` | `mise run test:engine` | An Open Cloud key with `universe-places:write` and `universe.place.luau-execution-session:write`, on an experience made only for tests. |
| `ROBLOX_UNIVERSE_ID` | `mise run test:engine` | That test experience's ID. |
| `ROBLOX_PLACE_ID` | `mise run test:engine` | The place the tests upload to and run in. |
| `JEST_ROBLOX_STUDIO_PATH` | `mise run test:engine` | WSL only, optional: Windows Studio's `RobloxStudioBeta.exe`, as a `/mnt/c/...` path; the newest install by default. |
| `JEST_ROBLOX_PLUGINS_DIR` | `mise run test:engine` | WSL only, optional: Windows Studio's plugins folder; found by default. |
| `RUR_ROBLOX_CONTENT` | `mise run ui` | Studio's `content` folder, for its fonts, where rur can't find Studio by itself (macOS and Linux without Studio). |
| `ROBLOX_PUBLISH_API_KEY` | `mise run publish` (not with `--managed partial`) | A key with `universe-places:write` on the experience you publish to. Keep it apart from the test key. |
| `ROBLOX_PUBLISH_UNIVERSE_ID` | `mise run publish` | That experience's ID. |
| `ROBLOX_PUBLISH_PLACE_ID` | `mise run publish` | The place's ID; in a multi-place game, each place's: `lobby=123,game=456`. |
| `ROBLOX_ERRORS_API_KEY` | `mise run errors` | A key with only `universe.analytics:read` (in the `universe-analytics` system too) on the experience you publish dev builds to, whose owner has analytics access to it. Read-only, and apart from the publish key. |
| `ROBLOX_ERRORS_UNIVERSE_ID` | `mise run errors` | That experience's ID. |
| `ROBLOX_ERRORS_PLACE_ID` | `mise run errors` | The dev place's ID; in a multi-place game, each place's: `lobby=123,game=456`. |
| `ASPHALT_API_KEY` | `mise run assets` | With the assets add-on: a key with `asset:read` and `asset:write`, owned by the creator in `asphalt.toml`. |

## In GitHub

Under **Settings > Secrets and variables > Actions** of the game's repository:

| Name | Kind | What |
| --- | --- | --- |
| `ROBLOX_OPEN_CLOUD_API_KEY` | secret | Runs every spec, engine specs included, in a real Roblox server, on pushes to main and when you run CI by hand, not on pull requests. Without the two variables that job shows as skipped; with them but without the key, it fails. |
| `ROBLOX_UNIVERSE_ID`, `ROBLOX_PLACE_ID` | variables | The test experience and place, as above. |
| `ROBLOX_PUBLISH_API_KEY` | environment secret | In each environment you use (`dev`, `stable` and `prod`; stable is optional): the key `.github/workflows/publish.yml` publishes that target with, with `universe-places:write` on that target's experience (see [Publishing](/publishing/)). `prod`'s key also needs `universe-datastores.control:snapshot`, because the workflow snapshots the DataStores before it publishes. |
| `ROBLOX_<TARGET>_UNIVERSE_ID`, `ROBLOX_<TARGET>_PLACE_ID` | variables | Each target's experience and place, such as `ROBLOX_DEV_PLACE_ID`. Without its place variable, a target's job shows as skipped. |
| `BOT_APP_CLIENT_ID`, `BOT_APP_PRIVATE_KEY` | secrets | A GitHub App with Contents read and write on the repository. When Renovate updates a tool or create-baseplate, `.github/workflows/renovate-fixups.yml` pushes the new `mise.lock` or the synced agent files as this app, so CI runs again and the update can merge. |
