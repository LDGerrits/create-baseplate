---
name: drive-studio
description: Run and drive the game in real Roblox Studio. Use to playtest, to check what ree and rur can't (characters, physics, the whole UI in play), to read Studio's output, or to take a screenshot of the running game.
---

# Drive Studio

Reach for Studio last: `mise run test` and `mise run ui` answer most questions in seconds without it. Studio is for what they don't emulate: characters and Humanoids, collisions and physics, the whole game running with its UI, and how it feels to play.

## Open Studio through forge

`forge up --studio --syncback --json` starts the session, or joins the running one: Studio opens hidden on the world, and Rojo syncs the compiled code into it. The session is yours when `data.started` is `true`; then `forge down --json` ends it when you're done. Leave a session someone else started running. `forge status --json` shows each part and the last compile's errors.

- **The user's Studio:** when forge reports that a Studio already had the place open (`origin: "found"`), it's the user's. Ask before closing it or saving in it.
- **To change the world** rather than look at it, follow the `edit-world` skill: saving and syncing back happen there, and only when the user asked for the change.

## Drive it with the Studio MCP

Roblox's Studio MCP drives Studio. If its tools aren't available to you, ask the user to install Roblox's official plugin: in Claude Code, `/plugin` and search for Roblox Studio; in Codex, `codex plugin marketplace add Roblox/roblox-studio-agent-plugin`. Studio then needs **Assistant → Settings → MCP Servers → Enable Studio as MCP server**.

1. `list_roblox_studios` first, and pick the Studio whose place forge opened. Confirm the target before you change anything in it.
2. Inspect without running code: `search_game_tree`, `inspect_instance`, `script_grep`.
3. Playtest: `start_stop_play`, then play as the user would: `user_mouse_input` and `user_keyboard_input` (`datamodel_type` `Client`), `character_navigation`. Read `get_console_output`, and look with `screen_capture`. To click a button, move to it by its path, which starts with `LocalPlayer`, then click:

   ```json
   [{ "action": "moveTo", "instance_path": "LocalPlayer.PlayerGui.ScreenGui.TextButton" },
    { "action": "mouseButtonClick", "mouse_button": "left" }]
   ```

   Then read the result with `execute_luau` on the `Client`, such as the button's `Text`.
4. `execute_luau` runs Luau when the tools above can't answer. It needs `datamodel_type` (`Edit`, or `Server`/`Client` during a playtest) and runs as a plugin, so its `_G` isn't the game's.
5. For debugging with breakpoints, profiling or other devices, Studio has Roblox's own skills: `list_skills`, then `skill` (`rbx-debug`, `rbx-perf-profiling`, `rbx-device-simulator-lua`). For API facts, `http_get` reads Roblox's documentation.

Edits made during a playtest are lost when it stops.

## Finish

Turn what you found into a test where you can (the `write-tests` skill), so it's checked without Studio from then on. Then end the session if it's yours, and tell the user what you played and saw.
