## Assets

Images, sounds, animations and models go in `assets/`, and Asphalt uploads them to Roblox. `mise run assets` uploads the new and changed files and writes their IDs to `src/shared/assets.luau`, typed by `assets.d.ts`: import it and write `assets.icons.coin` for `assets/icons/coin.png`, never a raw `rbxassetid://`. Commit those two files and `asphalt.lock.toml`, which records what is uploaded, as Asphalt writes them. An asset already on Roblox goes under `[inputs.assets.web]` in `asphalt.toml`, with its ID.

`mise run check` fails while a file in `assets/` isn't uploaded. An upload puts the file on the developer's Roblox account, under the creator in `asphalt.toml`, with the key `ASPHALT_API_KEY` in `.env`. Before the first upload, ask the developer for the creator (their user ID, or a group's) and to set the key; never guess an ID. After that, run `mise run assets` when they ask for the asset.
