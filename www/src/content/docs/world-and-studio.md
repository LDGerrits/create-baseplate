---
title: World and Studio
description: The map as files, syncback, and driving Studio from an agent.
---

## The world

The map and lighting live in `world/` as files, apart from the code: a project file per service, and a `.model.json` per instance (Terrain stays binary). Studio edits them, and syncback writes the edits back. Code reaches world instances through generated types, such as `Workspace.SpawnLocation`, so a missing part fails the compile.

`ror` renders the world to pictures without Studio, and compares two renders.

## Studio

`mise run dev` starts a session with [rbx-forge](https://github.com/christopher-buss/rbx-forge): the compiler on watch, Studio open on the world, and Rojo syncing the code in. `mise run sync` writes Studio's world edits into `world/`.

Agents drive Studio through Roblox's Studio MCP server: playtest, read the output, simulate input and take screenshots.
