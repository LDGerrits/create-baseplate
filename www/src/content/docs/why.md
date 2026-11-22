---
title: Why Baseplate
description: The principles behind Baseplate, and why it picks each part of its stack.
---

Coding agents write good roblox-ts and Luau when the project tells them, fast, whether they got it right. Most Roblox projects can't: their tests need Studio, their UI can only be seen in Studio, and their map lives in a binary place file. Baseplate is a starting point built around that loop, the way create-t3-app is one for typesafe web apps.

## Principles

### Agents first

Everything an agent needs to know whether its change works is one command, `mise run check`, which runs in about ten seconds and prints what to fix. Hooks run it before the agent ends its turn and block what agents get wrong here, such as editing generated files; the commit hook runs it on every commit, whoever commits. `AGENTS.md` and the skills hold what the code can't show. The CLI itself takes every answer as a flag, and `--json` prints one result, so an agent creates a game in one command.

### None is a choice

Like create-t3-app, each question offers the most used libraries and "none", which is the default. The base game brings only what nearly every game needs (a structure for services and controllers, a UI library, the tooling) and leaves state, saved data, entities, assets and release builds to you. An add-on is a folder of files and a manifest, so adding one never touches the base.

### Pin everything, and wait

Every tool is pinned in `mise.toml` with its checksums in `mise.lock`, and every package in `pnpm-lock.yaml` (and `wally.lock`, in a Luau game). pnpm installs only versions published at least two weeks ago, and Renovate proposes updates on the same rule: most hijacked releases are caught and pulled within days, so the wait keeps them out. Two tools the game's workflow rests on, rbx-forge and Rogen, come in on release day for their fixes, so their updates never merge without a person. So do a Luau game's Wally packages: Wally's registry gives no release dates for the wait to count from.

### Tested in the real engine

Specs run in seconds in ree, an emulated engine, but an emulator can be wrong. The same specs run in a real Roblox server through Open Cloud (`mise run test:engine`), in the game's CI once you add a key, and in Baseplate's own CI, where every add-on choice runs in a real server. A library update that breaks only in the real engine fails there.

### The world is files

Studio edits the map, and syncback writes it into readable JSON in `world/`, apart from the code. An agent can read and diff the world, and code reaches it through generated types: `Workspace.SpawnLocation` compiles, or in Luau type-checks, only if it exists.

## The stack

| Part | Why |
| --- | --- |
| [roblox-ts](https://roblox-ts.com) | Types catch most of an agent's mistakes before the game runs, and agents know TypeScript well. ESLint's roblox-ts rules catch the JavaScript habits that don't hold in Luau. |
| [Flamework](https://flamework.fireboltofdeath.dev) | Services and controllers give each feature an obvious shape, and its networking checks the types of what clients send at runtime, from the TypeScript types. |
| [Luau](https://luau.org), for `--language luau` | For teams that write Luau: luau-lsp type-checks every file strictly against every instance in the game, Selene and StyLua hold the style, and Wally brings the packages. Services and controllers are plain modules; remotes are declared once with a [`t`](https://github.com/osyrisrblx/t) check and a rate limit. See [Luau games](/luau/). |
| [Rogen](https://github.com/LDGerrits/rogen) | A file's folder (`server/`, `client/`, `shared/`) decides where it runs, so a feature is one folder and server code can't reach clients by mistake. `rogen check` tells an agent when the project file is out of date. |
| [rbx-forge](https://github.com/christopher-buss/rbx-forge) | Opens Studio on the world, serves the code and syncs Studio's edits back into files, from one command, WSL included. |
| [ree](https://github.com/Anime-Vanguards/roblox-engine-emulator) and [rur](https://github.com/Anime-Vanguards/roblox-ui-renderer) | Tests, end-to-end tests included, and UI pictures without Studio, in seconds and in CI, so the check can run them on every change and an agent can look at the UI it built. |
| [mise](https://mise.jdx.dev) | One file pins Node, pnpm, Rojo, the compiler and the rest, with checksums, and runs the same tasks on Linux, macOS, Windows and in cloud agents. Installing mise is the only setup. |
| [pnpm](https://pnpm.io) | The two-week rule (`minimumReleaseAge`), a strict lockfile, and the hoisted layout roblox-ts needs. |
