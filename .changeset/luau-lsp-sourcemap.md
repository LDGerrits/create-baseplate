---
"create-baseplate": patch
---

In a Luau game, Claude Code's language server sees modules and world parts added during the session. luau-lsp used to keep the `sourcemap.json` it read at startup, since Claude Code doesn't tell it about changed files, so a new module or part showed as "not found" until the next session. The edit hook now writes the sourcemap again when an edit adds a module or changes `world/`, and the plugin starts luau-lsp through `.agents/hooks/luau-lsp.ts`, which passes it the change.
