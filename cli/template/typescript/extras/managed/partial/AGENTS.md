## World and Studio

Studio owns this game's place and its world, the map and lighting: Rojo syncs only the code into it, and the repo has no `world/`. The world's instances aren't typed, so `Workspace.SpawnLocation` doesn't compile. Reach one with `WaitForChild` or `FindFirstChild` and check what you get: `const spawn = Workspace.WaitForChild("SpawnLocation"); if (!spawn.IsA("SpawnLocation")) return;`. The tests run in a place made of the code alone, so a spec or an end-to-end test creates the instances it needs.

To see or change the map, use the drive-studio skill on the user's Studio, or ask the user. The user saves the place and publishes it from Studio. `mise run dev` compiles on save and serves the code; the user connects the Rojo plugin in Studio to it.
