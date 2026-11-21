---
name: drive-studio
description: Run and drive the game in real Roblox Studio. Use to playtest, to check what ree and rur can't (characters, physics, the whole UI in play), to read Studio's output, or to take a screenshot of the running game.
---

# Drive Studio

Reach for Studio last: `mise run test` and `mise run ui` answer most questions in seconds without it. Studio is for what they don't emulate: characters and Humanoids, collisions and physics, the whole game running with its UI, and how it feels to play.

1. Start the session in the background: `forge up --studio --syncback` (the compiler on watch, Rojo serving the code, Studio on the world). `forge status` shows each part and the last compile's errors.
2. Drive Studio with Roblox's Studio MCP. If its tools aren't available to you, ask the user to add it. In Claude Code on Windows: `claude mcp add roblox-studio -- "%LOCALAPPDATA%\Roblox\mcp.bat"`. From WSL: `claude mcp add roblox-studio -- cmd.exe /c 'C:\Users\<user>\AppData\Local\Roblox\mcp.bat'`.
   - `list_roblox_studios` finds this session's Studio: its file is `world.rbxl`.
   - `start_stop_play` starts and stops a play test.
   - `execute_luau` runs Luau and needs `datamodel_type`: `Edit` to change the world, `Server` or `Client` during a play test. It runs as a plugin, so `_G` there isn't the game's.
   - `get_console_output` reads the Output; `screen_capture` takes a screenshot.
3. Turn what you found into a test where you can (see the `write-tests` skill), so it's checked without Studio from then on.
4. `forge down` when you're done; Studio stays open otherwise.

Edits made during a play test are lost when it stops. To keep a world change, make it in `Edit` and sync it (see the `edit-world` skill).
