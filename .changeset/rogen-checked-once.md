---
"create-baseplate": patch
---

Claude Code, Codex and Cursor no longer start Rogen's own stop hook beside the check, which ran `rogen check` a second time at every stop. The file `.agents/hooks/rogen-check.mjs` stays as Rogen writes it; only the wiring in `.claude/settings.json`, `.codex/hooks.json` and `.cursor/hooks.json` is gone.
