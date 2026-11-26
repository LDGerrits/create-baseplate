---
"create-baseplate": patch
---

Games work in git worktrees from any agent tool without setup. The check installs the locked packages before it loads any, so a new worktree's first check passes instead of failing on a missing package. A worktree without a `.env` reads the main checkout's, and `.worktreeinclude` is gone. The worktrees Claude Code and Gemini CLI put inside the game are gitignored, which keeps the main checkout's check passing while they exist. A worktree no longer registers its own copy of the Claude Code language server, which piled up in the main checkout's settings and in Claude Code's plugin list; `mise run install` in the main checkout removes the ones its settings still name.
