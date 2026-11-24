---
title: World and Studio
description: The map as files, syncback, and driving Studio from an agent.
---

## The world

The map and lighting live in `world/` as files, apart from the code: a project file per service, and a `.model.json` per instance (Terrain stays binary). Studio edits them, and syncback writes the edits back. Code reaches world instances through generated types, such as `Workspace.SpawnLocation`, so a missing part fails the compile.

The game is built from git, never edited in place: `mise run build` makes the place from the code and `world/`, and [publishing](/publishing/) does the same from a commit. An edit made in Studio and never synced back is lost on the next build.

- **Art.** Models from Studio's 3D Importer point to their meshes and textures by asset ID, so they stay small as JSON. Save a model that holds its own mesh data as an `.rbxm`, and syncback keeps it binary. Unions, `SurfaceAppearance` and wrap layers can't be in `world/`: Open Cloud's place publishing doesn't update them, so the check fails on them; import a union as a `MeshPart` instead. Source art (`.fbx`, `.blend`, `.psd`) goes in Git LFS, which `.gitattributes` sets up: run `git lfs install` once per machine.
- **Many copies of one asset.** Keep the asset once, in `world/ServerStorage/`, and place tagged marker parts where it stands; a server service swaps each for a copy when the game starts, so changing the asset changes every copy. The `edit-world` skill describes it.
- **Terrain** is one binary file that git can't merge: one person changes it at a time.

`ror` renders the world to pictures without Studio, and compares two renders.

## Studio

`mise run dev` starts a session with [rbx-forge](https://github.com/christopher-buss/rbx-forge): the compiler on watch, Studio open on the world, and Rojo syncing the code in. `mise run sync` writes Studio's world edits into `world/`. An edit to `world/`'s files reaches a running Studio only through `forge restart`, which rebuilds the place and drops edits not yet synced: Rojo serves only the code, and its live sync can't set a MeshId, Terrain or unions anyway.

Agents drive Studio through Roblox's Studio MCP server: playtest, read the output, simulate input and take screenshots.
