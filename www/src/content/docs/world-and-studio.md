---
title: World and Studio
description: The map as files, syncback, and driving Studio from an agent.
---

This page is about a game Rojo manages in full, the default. A game created with `--managed partial` keeps its world in Studio: see [When Studio keeps the world](#when-studio-keeps-the-world).

## The world

The map and lighting live in `world/` as files, apart from the code: a project file per service, and a `.model.json` per instance (Terrain stays binary). Studio edits them, and syncback writes the edits back. Code reaches world instances through generated types, such as `Workspace.SpawnLocation`, so a missing part fails the compile.

The game is built from git, never edited in place: `mise run build` makes the place from the code and `world/`, and [publishing](/publishing/) does the same from a commit. An edit made in Studio and never synced back is lost on the next build.

- **Art.** Models from Studio's 3D Importer point to their meshes and textures by asset ID, so they stay small as JSON. Save a model that holds its own mesh data as an `.rbxm`, and syncback keeps it binary. Open Cloud's place publishing doesn't update unions, `SurfaceAppearance` or wrap layers, so the check warns about each, and after changing one you publish from Studio; import a union as a `MeshPart` where you can. Source art (`.fbx`, `.blend`, `.psd`) goes in Git LFS, which `.gitattributes` sets up: run `git lfs install` once per machine.
- **Many copies of one asset.** Keep the asset once, in `world/ServerStorage/`, and place tagged marker parts where it stands; a server service swaps each for a copy when the game starts, so changing the asset changes every copy. The `edit-world` skill describes it.
- **Terrain** is one binary file that git can't merge: one person changes it at a time.

`ror` renders the world to pictures without Studio, and compares two renders.

## Studio

`mise run dev` starts a session with [rbx-forge](https://github.com/christopher-buss/rbx-forge): the compiler on watch, Studio open on the world, and Rojo syncing the code in. `mise run sync` writes Studio's world edits into `world/`. An edit to `world/`'s files reaches a running Studio only through `forge restart`, which rebuilds the place and drops edits not yet synced: Rojo serves only the code, and its live sync can't set a MeshId, Terrain or unions anyway.

Agents drive Studio through Roblox's Studio MCP server: playtest, read the output, simulate input and take screenshots.

## When Studio keeps the world

With `--managed partial`, Studio owns the place and its world, as in Roblox's [partially managed](https://create.roblox.com/docs/projects/rojo/partially-managed) workflow, and files hold only the code. There is no `world/`, no `mise run sync` and no `edit-world` skill, and no world types: `Workspace.SpawnLocation` doesn't compile, and in Luau isn't in the sourcemap. Code reaches an instance of the world with `WaitForChild` or `FindFirstChild` and checks its class.

`mise run dev` compiles on save (TypeScript) and serves the code with Rogen, and opens nothing: open your place in Studio and press **Connect** in the Rojo plugin. Rojo overwrites the scripts Studio holds with the code; the map stays yours, and you save and publish it from Studio.

The check and the tests don't need the world: they build and run a place made of the code alone, so a spec or an end-to-end test creates the instances it uses. Agents see or change the map through the Studio MCP server, in the Studio you've opened (the `drive-studio` skill), and `forge up --studio` opens a place of the code alone for a playtest.
