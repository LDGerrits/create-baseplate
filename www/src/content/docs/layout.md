---
title: Folder layout
description: What a created game holds, with one place or several, and what each add-on adds.
---

## One place

A TypeScript game:

```
src/
  app/                 entry scripts: start Flamework
  features/            one folder per feature, started by `mise run feature <name>`
  game/                the always-on systems features build on, one folder each
  platform/            game-agnostic code that would move unchanged to another game
tests/e2e/             end-to-end tests
world/                 the map and lighting, edited in Studio and synced back (not with --managed partial)
scripts/               the tasks' scripts: tests, UI pictures, the source checks
.agents/               agents' skills and hooks, shared by Claude Code, Codex and Cursor
mise.toml, mise.lock   the pinned tools and their checksums, and the tasks
```

A [Luau game](/luau/):

```
src/
  app/                 entry scripts: start the services and controllers
  features/            one folder per feature, started with `mise run feature <name>`
  game/                the always-on systems features build on, one folder each
  platform/            game-agnostic code that would move unchanged to another game
tests/e2e/             end-to-end tests
world/                 the map and lighting, edited in Studio and synced back (not with --managed partial)
wally.toml, wally.lock the Roblox packages
selene.toml, stylua.toml, .luaurc   lint, format and strict types
scripts/, .agents/, mise.toml       as in a TypeScript game
```

## Partially managed

With `--managed partial`, Studio owns the place and its world, and the files hold only the code. Compared with the layouts above, the game has no `world/` (and, in a TypeScript game, no `src/world.d.ts` or `scripts/world-types.ts`), no `mise run sync` and `mise run publish` tasks, no `scripts/publish.ts` and its test, `scripts/snapshot.ts` or `.github/workflows/publish.yml`, and no `edit-world` skill. It adds `scripts/dev.ts`, which `mise run dev` runs to serve the code to the Rojo plugin in Studio, and replaces `rbx-forge.config.ts`, `scripts/game-project.ts` and the `release` skill with versions for a place made of the code alone.

## Several places

With `--places multi`, laid out as [Rogen](https://github.com/LDGerrits/rogen) does for roblox-ts:

```
projects/
  common/src/            code every place shares: features/, game/ and platform/
  lobby/                 a place: default.rogen.json, src/app (its entry scripts), world/, tests/e2e/
  game/                  another place, laid out the same
tsconfig.<place>.json    compiles each place into out/<place>/
```

Below, `src/features/`, `src/game/` and `src/platform/` are in `projects/common/src/` in a multi-place game; the shared code never imports a place, and `app/` is each place's own, and `world/` and `tests/e2e/` are each place's.

## What each add-on adds

In a TypeScript game; a Luau game's are listed in [add-ons](/add-ons/#in-a-luau-game).

| Add-on | Files |
| --- | --- |
| `--ui vide` | No files: Vide's packages and JSX settings in place of React's, and its section of `AGENTS.md`. In a Luau game, Vide is the default, and `--ui react` swaps in react-lua's packages, `build-ui` skill and section. |
| `--state charm` | No files: Charm's packages and its section of `AGENTS.md`. |
| `--state reflex` | No files: Reflex's packages and its section of `AGENTS.md`. |
| `--data profilestore`, `--data lapis` | `src/game/player-data/server/`: `player-data.ts` (the data's shape), `player-data-service.ts` and its spec. |
| `--entities components` | `src/features/spinner/server/spinner-component.ts`, `world/Workspace/Spinner.model.json`, `tests/e2e/spinner.luau`. |
| `--entities jecs` | `src/features/spinner/server/`: `spinner-service.ts`, `spinner-system.ts` and its spec; the same world part and end-to-end test. |
| `--assets asphalt` | `assets/`, `asphalt.toml`, `scripts/assets.ts`, and the generated `src/game/assets/shared/assets.luau` and `.d.ts` once you upload. |
| `--release darklua` | `.darklua.json`, `scripts/darklua.ts`, `scripts/release-project.ts`. |
