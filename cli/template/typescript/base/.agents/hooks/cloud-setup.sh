#!/usr/bin/env bash
set -euo pipefail

MISE_VERSION="2026.11.8"
if [ "${1:-}" = "--pin" ]; then
	echo "version=$MISE_VERSION"
	exit 0
fi

force=false
[ "${1:-}" = "--force" ] && force=true
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] && ! $force; then
	local_mise=$(command -v mise 2>/dev/null || echo "$HOME/.local/bin/mise")
	# Not on Windows, where mise's PATH is Windows-style and Git Bash couldn't read it.
	case "$(uname -s)" in MINGW* | MSYS* | CYGWIN*) exit 0 ;; esac
	if [ -n "${CLAUDE_ENV_FILE:-}" ] && [ -x "$local_mise" ]; then
		"$local_mise" env -s bash 2>/dev/null >>"$CLAUDE_ENV_FILE" || true
	fi
	exit 0
fi

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

# rur renders the stories in the check through Vulkan; with no GPU it needs Mesa's software driver.
install_vulkan() {
	command -v apt-get >/dev/null || return 0
	dpkg -s mesa-vulkan-drivers >/dev/null 2>&1 && return 0
	local sudo=""
	if [ "$(id -u)" != 0 ]; then
		sudo -n true 2>/dev/null || return 0
		sudo="sudo -n"
	fi
	$sudo apt-get update -q && $sudo apt-get install -y -q --no-install-recommends mesa-vulkan-drivers ||
		echo "Couldn't install mesa-vulkan-drivers; story pictures may fail to render." >&2
}

# What this prints becomes context for the agent, so the install's output goes to stderr.
{
	export PATH="$HOME/.local/bin:$PATH"
	install_vulkan
	command -v mise >/dev/null || install_mise
	mise trust --quiet .
	mise install
	mise run install
} >&2

path_line="export PATH=\"$HOME/.local/bin:$HOME/.local/share/mise/shims:\$PATH\""
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
	echo "$path_line" >>"$CLAUDE_ENV_FILE"
elif $force && ! grep -qsF "$path_line" "$HOME/.bashrc"; then
	echo "$path_line" >>"$HOME/.bashrc"
fi
echo "Cloud setup done: tools and packages are installed; run \`mise run check\`. No Studio here, so story pictures have no text."
