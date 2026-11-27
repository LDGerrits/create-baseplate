---
name: drive-studio
description: Run and drive the game in real Roblox Studio. Use to playtest, to check what ree and rur can't (characters, physics, the whole UI in play), to read Studio's output, or to take a screenshot of the running game.
---

# Drive Studio

Reach for Studio last: `mise run test` and `mise run ui` answer most questions in seconds without it. Studio is for what they don't emulate: characters and Humanoids, collisions and physics, the whole game running with its UI, and how it feels to play.

## Open Studio through forge

Run `forge`, `ror` and the other tools below as `mise x -- forge …` when your shell doesn't activate mise (see `AGENTS.md`).

`forge up --studio --syncback --json` starts the session, or joins the running one: Studio opens hidden on the world, and Rojo syncs the compiled code into it. The session is yours when `data.started` is `true`; then `forge down --json` ends it when you're done. Leave a session someone else started running. `forge status --json` shows each part and the last compile's errors.

- **The user's Studio:** when forge reports that a Studio already had the place open (`origin: "found"`), it's the user's. Ask before closing it or saving in it.
- **To change the world** rather than look at it, follow the `edit-world` skill: saving and syncing back happen there, and only when the user asked for the change.

## Drive it with the Studio MCP

Roblox's Studio MCP drives Studio. If its tools aren't available to you, ask the user to connect it: in Studio, **Assistant → … → Manage MCP Servers → Enable Studio as MCP server**, then under **Quick connect** turn on their agent (Claude Code, Codex CLI, Cursor, Gemini CLI and VS Code are listed), and restart the agent. Its server is named `Roblox_Studio`.

The MCP can change the place in ways this project doesn't keep, so leave these alone:

- **Scripts** (`multi_edit`): the code lives in `src/` and Rojo overwrites scripts in Studio. Change the TypeScript and let forge sync it.
- **Saving** (`save_place`): saving and syncing back to `world/` happen in the `edit-world` skill, and only when the user asked for the change.
- **Assets** (`insert_asset`, `generate_*`, `upload_image`): only as part of a world change the user asked for, through `edit-world`.
- **The live game** (`open_cloud_invoke`, and `execute_luau` that reaches DataStores, MemoryStores, messaging or HTTP): it publishes, restarts servers and changes real players' data, and a hook blocks it. Tell the user what you would run. The hook only sees the names in your code, so Luau that calls the game's own modules, which use DataStores, gets past it: don't run code that saves player data, and in Studio's settings keep API access off unless the user turned it on.

1. `list_roblox_studios` first, and pick the Studio whose place forge opened. Confirm the target before you change anything in it.
2. Inspect without running code: `search_game_tree`, `inspect_instance`, `script_grep`.
3. Playtest: `start_stop_play`, then play as the user would: `user_mouse_input` and `user_keyboard_input` (`datamodel_type` `Client`), `character_navigation`. Read `get_console_output`, and look with `screen_capture`. To click a button, move to it by its path, which starts with `LocalPlayer`, then click:

   ```json
   [{ "action": "moveTo", "instance_path": "LocalPlayer.PlayerGui.ScreenGui.TextButton" },
    { "action": "mouseButtonClick", "mouse_button": "left" }]
   ```

   Then read the result with `execute_luau` on the `Client`, such as the button's `Text`.
4. `execute_luau` runs Luau when the tools above can't answer. It needs `datamodel_type` (`Edit`, or `Server`/`Client` during a playtest) and runs as a plugin, so its `_G` isn't the game's.
5. For debugging with breakpoints, profiling or other devices, Studio serves Roblox's own skills: list them with its tool that lists Roblox skills (Roblox renames these tools, so go by what it offers), then load `rbx-debug`, `rbx-perf-profiling`, `rbx-device-simulator-lua` or `rbx-scene-analysis`. Leave its `rbx-unit-test` alone: this game's tests run in ree (the `write-tests` skill). For API facts, `http_get` reads Roblox's documentation.

## Finish

Turn what you found into a test where you can (the `write-tests` skill), so it's checked without Studio from then on. Then end the session if it's yours, and tell the user what you played and saw.
