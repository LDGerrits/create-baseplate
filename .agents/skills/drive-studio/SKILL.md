---
name: drive-studio
description: Run and drive the game in real Roblox Studio. Use to playtest, to check what ree and rur can't (characters, physics, the whole UI in play), to read Studio's output, or to take a screenshot of the running game.
---

# Drive Studio

Reach for Studio last. ree (`mise run test`), rur (`mise run ui`) and ror (see the `edit-world` skill) answer most questions in seconds without it. Studio is for what they don't emulate: characters and Humanoids, collisions and physics, the whole game running with its UI, and how it feels to play.

## Start and stop

- `forge up --studio --syncback` starts the session in the background: the compiler on watch, Rojo serving the code, and Studio on the world.
- `forge status` shows each part and the last compile's errors; `forge show` brings Studio's window up for the user; `forge restart` replaces Studio with a fresh build.
- `forge down` stops everything. Run it when you're done; Studio stays open otherwise.

## Drive it with the Studio MCP

Roblox Studio ships an MCP server that controls a running Studio. If its tools aren't available to you, ask the user to add it. In Claude Code on Windows: `claude mcp add roblox-studio -- "%LOCALAPPDATA%\Roblox\mcp.bat"`. From WSL: `claude mcp add roblox-studio -- cmd.exe /c 'C:\Users\<user>\AppData\Local\Roblox\mcp.bat'`.

- `list_roblox_studios` finds the session's Studio: its file is `world.rbxl`.
- `execute_luau` runs Luau. Pass `datamodel_type`: `Edit` to change the world, `Server` or `Client` during play.
- `start_stop_play` starts and stops a play test; `get_studio_state` says which mode Studio is in.
- `get_console_output` reads the Output window: errors and warnings from the game's scripts.
- `screen_capture` takes a screenshot of the viewport; `user_keyboard_input`, `user_mouse_input` and `character_navigation` play as the player.

## Playtest

1. Start the session, then a play test with `start_stop_play`.
2. Act as the player, and check the outcome with `execute_luau` on the `Server` data model, `get_console_output` and `screen_capture`.
3. Stop the play test. Turn what you found into a test where you can (see the `write-tests` skill), so it's checked without Studio from then on.
4. Edits made during play are lost when it stops. To keep a world change, make it in the `Edit` data model and sync it (see the `edit-world` skill).
