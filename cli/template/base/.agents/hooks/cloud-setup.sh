#!/usr/bin/env bash
# SessionStart hook for Claude Code's cloud sessions (CLAUDE_CODE_REMOTE=true): installs mise, the
# pinned tools and the packages, so `mise run check` works there too. Locally it does nothing.
# Cloud sessions have no Roblox Studio: `mise run ui` draws no text, and Studio work isn't possible.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}"

# mise itself, pinned and checked: the release CI uses (`version:` of jdx/mise-action in
# .github/workflows/ci.yml), from GitHub, against the SHA-256s its release publishes (SHASUMS256.txt).
# Renovate doesn't see this pin: when CI's version changes, change it and both sums here too.
MISE_VERSION="2026.11.8"
install_mise() {
	local arch sum
	case "$(uname -m)" in
	x86_64) arch="x64" sum="32b6abe844efa43d37d7ac4ed21d2ec41e9479d66feb19b0db8d2c548cd6e36d" ;;
	aarch64 | arm64) arch="arm64" sum="0de1450dcc3f838e372e05e8c5231423760ad3f22d14275ef340bc0a250303ce" ;;
	*)
		echo "No pinned mise for $(uname -m)" >&2
		return 1
		;;
	esac
	mkdir -p "$HOME/.local/bin"
	curl -fsSL -o "$HOME/.local/bin/mise" \
		"https://github.com/jdx/mise/releases/download/v$MISE_VERSION/mise-v$MISE_VERSION-linux-$arch"
	echo "$sum  $HOME/.local/bin/mise" | sha256sum --check --quiet
	chmod +x "$HOME/.local/bin/mise"
}

# What this prints becomes context for the agent, so the install's output goes to stderr.
{
	export PATH="$HOME/.local/bin:$PATH"
	command -v mise >/dev/null || install_mise
	mise trust --quiet .
	mise install
	mise run install
} >&2

# Later shell commands in the session find mise and the tools.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
	echo "export PATH=\"$HOME/.local/bin:$HOME/.local/share/mise/shims:\$PATH\"" >>"$CLAUDE_ENV_FILE"
fi
echo "Cloud setup done: tools and packages are installed; run \`mise run check\`. No Studio here, so story pictures have no text."
