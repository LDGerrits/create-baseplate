---
"create-baseplate": patch
---

Fixes from running games end to end with each agent tool:

- The hooks work in a game that isn't a git repo: the edit hook formats and lints, and the stop hook runs the check.
- The hooks find mise when it sits only in `~/.local/bin`, as for apps started outside a shell and for cloud agents.
- Cursor and Copilot also run Claude Code's hooks, so the Claude copy now stands down there: each hook runs once, and Cursor's limit on follow-ups holds.
- `mise run ui -- --story` no longer crashes on a TypeScript story that prints nothing. It prints pictures' paths from the root in a multi-place game, and fails when an action finds no node, listing the names it could use.
- `mise run test` and `mise run ui -- --filter` fail when the filter matches nothing, rather than passing.
- Test failures come without terminal colour codes, so agents read them as plain text.
- `mise run doc` and the version update say what they need when they can't fetch create-baseplate.
- The Gemini CLI guard also covers `read_many_files`.
- `mise run dev` and the other per-place tasks pass a SIGTERM on to what they run, so stopping a background `dev` stops forge rather than leaving it running.
