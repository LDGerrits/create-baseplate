#!/usr/bin/env bash
# SessionStart hook for Claude Code's cloud sessions (CLAUDE_CODE_REMOTE=true): installs mise, the
# pinned tools and the packages, so `mise run check` works there too. Locally it does nothing.
# Cloud sessions have no Roblox Studio: `mise run ui` draws no text, and Studio work isn't possible.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}"

# What this prints becomes context for the agent, so the install's output goes to stderr.
{
	export PATH="$HOME/.local/bin:$PATH"
	command -v mise >/dev/null || curl -fsSL https://mise.run | sh
	mise trust --quiet .
	mise install
	mise run install
} >&2

# Later shell commands in the session find mise and the tools.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
	echo "export PATH=\"$HOME/.local/bin:$HOME/.local/share/mise/shims:\$PATH\"" >>"$CLAUDE_ENV_FILE"
fi
echo "Cloud setup done: tools and packages are installed; run \`mise run check\`. No Studio here, so story pictures have no text."
