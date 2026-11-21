---
title: Getting started
description: Create a game, install its tools, and run its check.
---

## What you need

- [mise](https://mise.jdx.dev/getting-started.html), which installs every tool the game pins: Node, pnpm, Rojo, Sloptor, Lune and the offline engine and renderers.
- git.
- Roblox Studio, to play the game and edit the world. Checks and tests don't need it.

## Create a game

```sh
pnpm create baseplate my-game
```

It asks whether to make a git repo and install now, then creates the folder, installs the tools and packages, and makes the first commit. To skip the questions, as an agent would:

```sh
pnpm create baseplate my-game --yes
```

See [the CLI](/cli/) for every flag.

## Then

```sh
cd my-game
mise run check   # everything should pass
mise run dev     # compile on save, open Studio on the world, sync the code into it
```

Open the folder with your coding agent. Its `AGENTS.md` tells the agent how the project works, and the agent's hooks run the check for it.
