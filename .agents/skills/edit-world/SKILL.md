---
name: edit-world
description: Change or inspect the game's world, the map, lighting and placed models in world/. Use when adding or moving parts or models, changing lighting, syncing Studio's edits back, or asked what the map looks like.
---

# Edit the world

The world lives in `world/` as files, apart from the code:

- `world/default.project.json` maps each world service (`Workspace`, `Lighting`) to a project file beside it, which holds the service's properties, and a folder of its instances. An instance is a `.model.json`; Terrain is an `.rbxm`.
- Rojo serves only the code; Studio opens a place built from `world/` alone; syncback writes Studio's edits into `world/` and never touches code.
- `game.project.json` (generated) joins code and world for builds and tests. `src/world.d.ts` (generated) types every world instance, so code can write `Workspace.SpawnLocation`.

## Look at it

`mise run build`, then `ror render build/game.rbxl --views iso,top --out build/world-render`, and open the pictures. No Studio needed.

- One model: add `--focus Workspace.<Name>`.
- Before and after a change: render before with `--ids`; after the change, render again with `--ids --camera-from <before folder>`, so both use one camera. `ror diff <before> <after>` then names the parts that changed and writes a `.diff.png` per view.

## Change it in Studio

1. Start the session in the background: `forge up --studio --syncback`. Studio opens on the world and Rojo adds the code. `forge status` shows each part.
2. Edit in Studio: by hand, or through the Studio MCP's `execute_luau` with `datamodel_type` `Edit` (see the `drive-studio` skill).
3. Run `mise run sync`. It saves the place through Studio's File menu, then syncback writes the edits into `world/`, sorts the JSON and regenerates the types.
4. Read the diff of `world/`. Remove anything you didn't mean to change, such as an attribute a Studio plugin left.
5. Run `mise run check`, and `forge down` when you're done.

## Change it in files

Edit or add a `.model.json` under `world/<Service>/`, then run `mise run check`. If a forge session is running, `forge restart` rebuilds Studio's place from `world/`.

## Gotchas

- Sync with `mise run sync`, not `forge sync` alone: without a save first, syncback reads the last saved place. forge's `capture` save method keeps instances deleted in Studio (rbx-forge#323), so the config saves through the File menu.
- Syncback writes each new instance as a `.model.json`, because `mise.toml` sets `ROJO_SYNCBACK_DEBUG=2`. A link to another instance, such as a weld's `Part0`, is a `Rojo_Target_<Property>` attribute holding that instance's `Rojo_Id`. An instance keeps the file type it already has: read an `.rbxm` with Lune, `roblox.deserializeModel(fs.readFile(path))`.
- Studio joins touching parts with a `Snap` when it opens the place; syncback keeps the joint, with `Rojo_Id` attributes to link it.
- A service lives in the code or the world, never both. To add one, such as `SoundService`, give it a project file and a folder like `Workspace`, and map it in `world/default.project.json`.
