---
"create-baseplate": minor
---

The guard and the stop check now run in GitHub Copilot (cloud agent and CLI, `.github/hooks/checks.json`) and Gemini CLI (`.gemini/settings.json`, which also points Gemini at `AGENTS.md`), as well as Claude Code, Codex and Cursor. Hooks start through `.agents/hooks/run`, which finds mise in `~/.local/bin` too and lets the agent carry on when mise is missing. The stop check skips its run when nothing changed since the last pass, and in Cursor it no longer restarts the agent after you press Stop. `.agents/hooks/cloud-setup.sh --force` sets up Cursor's cloud agents (`.cursor/environment.json`), Codespaces (`.devcontainer/devcontainer.json`) and Codex cloud; the Copilot setup steps install the Vulkan driver the UI check needs. Claude Code no longer asks before the `forge`, `ror` and `rogen` commands the skills use, and `mise run install` restores the `.claude/skills` link on Windows clones without symbolic links.
