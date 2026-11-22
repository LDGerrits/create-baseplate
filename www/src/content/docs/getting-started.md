---
title: Getting started
description: Create a game, install its tools, and run its check.
---

## What you need

- [mise](https://mise.jdx.dev/getting-started.html), which installs every tool the game pins: Node, pnpm, Rojo, Sloptor, Lune and the offline engine and renderers.
- Node and pnpm, to run `pnpm create`. Without them, let mise bring them for that one command: `mise x node@24 pnpm@12 -- pnpm create baseplate my-game`.
- git.
- Roblox Studio, to play the game and edit the world. Checks and tests don't need it.

Games work on Windows, macOS and Linux, and in WSL. On Windows, install mise with `winget install jdx.mise`, and git with [Git for Windows](https://git-scm.com/download/win), whose shell runs the commit hook; the game's tasks run in any terminal.

## Create a game

```sh
pnpm create baseplate my-game
```

It asks which add-ons to use (and the game's name, when no folder is given) (see [add-ons](/add-ons/)), then whether to make a git repo and install now. Then it creates the folder, installs the tools and packages, and makes the first commit. To skip the questions, as an agent would:

```sh
pnpm create baseplate my-game --yes
```

See [the CLI](/cli/) for every flag.

## For agents

To create a game for a user, run `pnpm create baseplate <name> --json`. It asks nothing, installs everything, makes the first commit, and prints one JSON result with the folder and the next steps. Then work inside that folder and read its `AGENTS.md` first: it explains the project, and `mise run check` is the check to run after each change.

## Then

```sh
cd my-game
mise run check   # everything should pass
mise run dev     # compile on save, open Studio on the world, sync the code into it
```

Open the folder with your coding agent. Its `AGENTS.md` tells the agent how the project works, and the agent's hooks run the check for it.
