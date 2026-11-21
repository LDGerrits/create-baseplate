---
title: Troubleshooting
description: What goes wrong when setting up or running a game, and how to fix it.
---

## Creating a game

- **`npm create` ignores the flags.** npm reads flags before a `--` as its own. Put them after it: `npm create baseplate@latest my-game -- --yes`. With pnpm, no `--` is needed.
- **"The game is inside the git repo at …".** A folder above the game is a git repository, often a home folder someone ran `git init` in. Create the game elsewhere, or run `git init` in the game's folder yourself.
- **"The first commit failed: Please tell me who you are".** git has no name and email yet: `git config --global user.name "…"` and `git config --global user.email "…"`, then commit.
- **"mise isn't installed".** Install it from [mise.jdx.dev](https://mise.jdx.dev/getting-started.html), then run the next steps the CLI printed.

## Tools and packages

- **A command isn't found, such as `rogen` or `ror`.** The game's tools are on the PATH only where your shell activates mise. Run them as `mise x -- rogen …`, or add mise's activation to your shell.
- **"… is not in the lockfile".** A tool's pin in `mise.toml` changed without `mise.lock`. Run `mise lock`, and commit `mise.lock`.
- **"Regenerate the lockfile" from pnpm.** `package.json` changed without `pnpm-lock.yaml`. Run `mise exec -- pnpm install`, and commit the lockfile.
- **pnpm refuses a package version.** It installs only versions published at least two weeks ago. Pick an older version.

## Windows and WSL

- **Native Windows:** install mise (`winget install jdx.mise`) and [Git for Windows](https://git-scm.com/download/win). The tasks run in any terminal; the commit hook runs in Git's own shell.
- **WSL:** the game runs in WSL, Studio on Windows. `mise run ui` finds Windows Studio's fonts by itself; `mise run test:engine` needs `JEST_ROBLOX_STUDIO_PATH` and `JEST_ROBLOX_PLUGINS_DIR` in `.env` (see [environment variables](/environment/)).

## Pictures and Studio

- **Story pictures have no text.** rur draws text with Studio's fonts. On macOS, or Linux without Studio, set `RUR_ROBLOX_CONTENT` to Studio's `content` folder.
- **"rur found no graphics adapter".** The machine has no GPU and no software renderer, so no story was rendered. On Linux, install Mesa's Vulkan driver: `sudo apt-get install mesa-vulkan-drivers`.
- **`mise run dev` asks for a place.** A multi-place game has several: name one, as in `mise run dev lobby`.
