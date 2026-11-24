## World and Studio

Studio owns this game's place and its world, the map and lighting: Rojo syncs only the code into it, and the repo has no `world/`. luau-lsp doesn't know the world's instances, so `workspace.SpawnLocation` fails the check. Reach one with `WaitForChild` or `FindFirstChildOfClass` and check its class. The tests run in a place made of the code alone, so a spec or an end-to-end test creates the instances it needs.

To see or change the map, use the drive-studio skill on the user's Studio, or ask the user. The user saves the place and publishes it from Studio. `mise run dev` serves the code; the user connects the Rojo plugin in Studio to it. To run the game in real Studio, for a playtest, characters, physics, its output or a screenshot, read `.agents/skills/drive-studio/SKILL.md`.
