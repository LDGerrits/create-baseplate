---
title: Folder layout
description: What a created game holds, with one place or several, and what each add-on adds.
---

## One place

A TypeScript game:

```
src/
  app/                 entry scripts: start Flamework, mount the UI
  features/
    clicker/           an example feature
      server/          clicker-service.ts: owns the counts, checks the cooldown; its spec
      client/          clicker-controller.ts, clicker-button.tsx and its story
      shared/          clicker-network.ts
  network/server/      rate-limit.ts: middleware that rate-limits a remote per player; its spec
tests/e2e/             end-to-end tests: clicker.luau
world/                 the map and lighting, edited in Studio and synced back
scripts/               the tasks' scripts: tests, UI pictures, the source checks
.agents/               agents' skills and hooks, shared by Claude Code, Codex and Cursor
mise.toml, mise.lock   the pinned tools and their checksums, and the tasks
```

A [Luau game](/luau/):

```
src/
  app/                 entry scripts: start the services and controllers, mount the UI
  features/
    clicker/           an example feature
      server/          ClickerService.luau: owns the counts, checks the cooldown; its spec
      client/          ClickerController.luau, ClickerButton.luau and its story
      shared/          ClickerNetwork.luau: the remotes (Remo), their types and validators
tests/e2e/             end-to-end tests: clicker.luau
world/                 the map and lighting, edited in Studio and synced back
wally.toml, wally.lock the Roblox packages
selene.toml, stylua.toml, .luaurc   lint, format and strict types
scripts/, .agents/, mise.toml       as in a TypeScript game
```

## Several places

With `--places multi`, laid out as [Rogen](https://github.com/LDGerrits/rogen) does for roblox-ts:

```
projects/
  common/src/features/   code every place shares: clicker/, as an example feature
  common/src/network/    the rate-limit middleware
  lobby/                 a place: default.rogen.json, src/app (its entry scripts), world/, tests/e2e/
  game/                  another place, laid out the same
tsconfig.<place>.json    compiles each place into out/<place>/
```

Below, `src/features/` is `projects/common/src/features/` and `src/network/` is `projects/common/src/network/` in a multi-place game, and `world/` and `tests/e2e/` are each place's.

## What each add-on adds

In a TypeScript game; a Luau game's are listed in [add-ons](/add-ons/#in-a-luau-game).

| Add-on | Files |
| --- | --- |
| `--ui vide` | Vide versions of `src/app/client/app.tsx` and `start.tsx`, and of the clicker button and its story; React's packages go. |
| `--state charm` | `clicker-controller.ts` keeps the count in a Charm signal, and `app.tsx` reads it. |
| `--state reflex` | `src/store/client/client-store.ts`, `clicker-slice.ts` and its spec, and the controller and `app.tsx` using them. |
| `--data profilestore`, `--data lapis` | `src/features/player-data/server/`: `player-data.ts` (the data's shape), `player-data-service.ts` and its spec. |
| `--entities components` | `src/features/spinner/server/spinner-component.ts`, `world/Workspace/Spinner.model.json`, `tests/e2e/spinner.luau`. |
| `--entities jecs` | `src/features/spinner/server/`: `spinner-service.ts`, `spinner-system.ts` and its spec; the same world part and end-to-end test. |
| `--assets asphalt` | `assets/`, `asphalt.toml`, `scripts/assets.ts`, and the generated `src/shared/assets.luau` and `.d.ts` once you upload. |
| `--release darklua` | `.darklua.json`, `scripts/darklua.ts`, `scripts/release-project.ts`. |
