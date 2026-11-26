---
"create-baseplate": patch
---

`mise run doc` works offline and before create-baseplate is on npm: the CLI keeps this version's docs in the game's `.baseplate/docs` when it creates the game and on each `create-baseplate sync`, and the task reads them there. Setting `BASEPLATE_NO_CLAUDE_PLUGIN=1` keeps `mise run install` from registering the Claude Code language-server plugin, for games made only to try something.
