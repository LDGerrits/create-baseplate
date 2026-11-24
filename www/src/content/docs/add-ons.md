---
title: Add-ons
description: The UI library, the place layout, and the libraries and tools the CLI can add for state, player data, entities, assets and release builds; what each wires in, and how to take it out.
---

The base game brings Flamework and React with a few small helpers they work well with, and asks about libraries for state, data and entities. Like create-t3-app, the CLI asks about each, offering the most used libraries or none. None is the default, except for state: Reflex in TypeScript (Charm with Vide, which Reflex doesn't support) and Charm in Luau. It also asks which UI library to use and how many places:

| Question | Flag | Choices |
| --- | --- | --- |
| Language | `--language` | `typescript` (default, roblox-ts), `luau` |
| UI | `--ui` | `react` (default, [React](https://react.dev) for Roblox), `vide` ([Vide](https://github.com/centau/vide)) |
| Places | `--places` | `single` (default), `multi` |
| Client state | `--state` | `charm` ([Charm](https://github.com/littensy/charm); Luau's default), `reflex` ([Reflex](https://github.com/littensy/reflex); TypeScript only, its default), `none` |
| Player data | `--data` | `profilestore` ([ProfileStore](https://github.com/MadStudioRoblox/ProfileStore)), `lapis` ([Lapis](https://github.com/nezuo/lapis)), `none` |
| Entities | `--entities` | `components` ([Flamework Components](https://flamework.fireboltofdeath.dev/docs/additional-modules/components); TypeScript only), `jecs` ([Jecs](https://github.com/Ukendio/jecs)), `none` |
| Assets | `--assets` | `asphalt` ([Asphalt](https://github.com/jackTabsCode/asphalt)), `none` |
| Release builds | `--release` | `darklua` ([Darklua](https://darklua.com)), `none` |

```sh
pnpm create baseplate my-game --state charm --data profilestore --entities components
```

Each add-on arrives wired in and tested, with a section in the game's `AGENTS.md` that tells agents how to use it. CI creates games with each choice alone, every question answered together, and enough combinations that every two choices meet in some game. The CLI refuses only what can't work: Reflex with Vide. [Folder layout](/layout/) lists the files each one adds.

## UI: Vide

`--ui vide` swaps React for [Vide](https://github.com/centau/vide), fine-grained reactivity without re-renders. The example UI (`app.tsx`, `start.tsx`, the clicker button and its story), the JSX settings in `tsconfig.json` and `AGENTS.md`'s UI section become Vide's; React, its hooks, Ripple, React DevTools and React's lint rules go. [UI](/ui/#vide) has the differences. Going back to React means rewriting the UI: create a game without the flag and copy its `src/app/client` and the button.

## Places: several

`--places multi` lays the game out as [Rogen](https://github.com/LDGerrits/rogen) does for roblox-ts: shared code in `projects/common/src`, and a lobby and a game in `projects/`, each with its own entry scripts, world, end-to-end tests, Rogen config and `tsconfig.<place>.json`. `mise run check` builds and tests every place; Studio commands name one: `mise run dev lobby`. The other add-ons follow it, so Asphalt writes its code into the shared code. There's no switch back; to move to one place, create a game without the flag and move the features into it.

## State: Charm

`--state charm` keeps the clicker's count in a [Charm](https://github.com/littensy/charm) signal that `ClickerController` owns; `app.tsx` reads it with `useSignalState` from `@rbxts/react-charm` (with Vide, `@rbxts/vide-charm`). Packages: `@rbxts/charm` and its UI binding. Files: `clicker-controller.ts` and `app.tsx`.

To remove it, put back the base game's `clicker-controller.ts` and `app.tsx` (from a game created without the flag), and `pnpm remove @rbxts/charm @rbxts/react-charm`.

## State: Reflex

`--state reflex` adds one [Reflex](https://github.com/littensy/reflex) store, `src/store/client/client-store.ts`, made of a slice per feature (`clicker-slice.ts`, with a spec). `ClickerController` changes it through the store's actions, and `app.tsx` reads it with `useSelector` inside a `ReflexProvider`. Packages: `@rbxts/reflex`, `@rbxts/react-reflex`. Reflex has no Vide binding, so a Vide game takes Charm by default.

To remove it, delete `src/store/` and `clicker-slice.ts` and its spec, put back the base game's `clicker-controller.ts` and `app.tsx`, and `pnpm remove @rbxts/reflex @rbxts/react-reflex`.

## Player data: ProfileStore

`--data profilestore` adds `PlayerDataService` in `src/features/player-data/server/`: it loads each player's data with [ProfileStore](https://github.com/MadStudioRoblox/ProfileStore) when they join and saves it when they leave, with session locking (another server taking the session kicks the player to rejoin). Other services use `get(userId)` and `update(userId, fn)`. New fields go in `player-data.ts`; `Reconcile` gives old saves the new defaults. Studio and the specs use ProfileStore's mock store. Package: `@rbxts/profile-store`; the service is imported in `main.server.ts`.

To remove it, delete `src/features/player-data/`, its import in `main.server.ts`, and `pnpm remove @rbxts/profile-store`.

## Player data: Lapis

`--data lapis` adds the same `PlayerDataService`, on [Lapis](https://github.com/nezuo/lapis): validated documents, with migrations for data saved before a field existed. Lapis rejects data `validate` doesn't accept. Studio and the specs use `@rbxts/lapis-mockdatastore`; specs that load data skip in an Open Cloud session, where Lapis doesn't move without physics. Packages: `@rbxts/lapis`, `@rbxts/lapis-mockdatastore`.

To remove it, delete `src/features/player-data/`, its import in `main.server.ts`, and `pnpm remove @rbxts/lapis @rbxts/lapis-mockdatastore`.

## Entities: Flamework Components

`--entities components` adds `SpinnerComponent` (`src/features/spinner/server/spinner-component.ts`), a [Flamework Components](https://flamework.fireboltofdeath.dev/docs/additional-modules/components) class that spins each part tagged `Spinner`; `world/Workspace/Spinner.model.json` is one, and `tests/e2e/spinner.luau` checks it turns. Package: `@flamework/components`; the component is imported in `main.server.ts`.

To remove it, delete `src/features/spinner/`, the model, the end-to-end test and the import, and `pnpm remove @flamework/components`.

## Entities: Jecs

`--entities jecs` adds `SpinnerService`, which makes a [Jecs](https://github.com/Ukendio/jecs) entity for each part tagged `Spinner` and runs `spinnerSystem` each frame. Systems are functions of the world and the time, so `spinner-system.spec.ts` runs one on its own world. The same world part and end-to-end test come with it. Package: `@rbxts/jecs`.

To remove it, delete `src/features/spinner/`, the model, the end-to-end test and the import in `main.server.ts`, and `pnpm remove @rbxts/jecs`.

## Assets: Asphalt

`--assets asphalt` adds [Asphalt](https://github.com/jackTabsCode/asphalt): files in `assets/` upload to Roblox with `mise run assets`, which writes their IDs to `src/shared/assets.luau`, typed by `assets.d.ts`: `assets.icons.coin` for `assets/icons/coin.png`. You set who owns the uploads, your account or a group, in `asphalt.toml`, and the key `ASPHALT_API_KEY` in `.env`. `mise run check` fails while a file isn't uploaded, so a commit can't ship an asset the game can't load. Files: `asphalt.toml`, `assets/`, `scripts/assets.ts`; the tool and the `assets` task in `mise.toml`, and a step in `check` and `ci`.

To remove it, delete those files and the generated ones, the Asphalt lines in `mise.toml` (then `mise lock`), the key in `.env.example`, and the generated files' entries in `biome.json`, `eslint.config.ts` and `.gitignore`.

## Release builds: Darklua

`--release darklua` adds `mise run release`: it processes the compiled code with [Darklua](https://darklua.com) into `dist/`, by the rules in `.darklua.json` (minified, dead code removed, locals renamed), builds `build/release.rbxl` from it and runs the tests on that build, so what you publish is what was tested. The game's CI runs it too. When the tests pass in `check` and fail in `release`, a rule broke the code: remove it from `.darklua.json`. Files: `.darklua.json`, `scripts/darklua.ts`, `scripts/release-project.ts`; the tool and the `release` task in `mise.toml`.

To remove it, delete those files, the Darklua lines in `mise.toml` (then `mise lock`), `/dist` in `.gitignore`, and the `mise run release` step in `.github/workflows/ci.yml`.

## In a Luau game

A [Luau game](/luau/) asks the same questions, with what Luau games use, and each choice does what its section above says, in Luau's files:

| Add-on | Packages (Wally) | Files |
| --- | --- | --- |
| `--places multi` | | Rogen's Luau layout: `<place>.rogen.json` at the root, shared code in `projects/common/src`, each place in `projects/<place>/` (see [Luau games](/luau/#several-places)) |
| `--ui vide` | `centau/vide`, `littensy/vide-ripple`, in place of react-lua | Vide versions of `src/app/client/App.luau` and `Start.luau`, and of the clicker button and its story (`CreateVideStory`) |
| `--state charm` | `littensy/charm`, with `littensy/react-charm` or `littensy/vide-charm` | `ClickerController.luau` keeps the count in a Charm signal, and `App.luau` reads it |
| `--data profilestore` | `lm-loleris/profilestore`, a server package | `src/features/playerdata/server/`: `PlayerData.luau`, `PlayerDataService.luau` and its spec |
| `--data lapis` | `nezuo/lapis`, `nezuo/data-store-service-mock`, server packages | the same three files, on Lapis |
| `--entities jecs` | `ukendio/jecs` | `src/features/spinner/server/`: `SpinnerSystem.luau` and its spec, `SpinnerService.luau`; the world part and `tests/e2e/spinner.luau` |
| `--assets asphalt` | | `assets/`, `asphalt.toml`, `scripts/assets.ts`; uploads write `src/shared/Assets.luau`, which luau-lsp types from its table |
| `--release darklua` | | `.darklua.json`, `scripts/darklua.ts`, `scripts/release-project.ts`; `mise run release` processes `src/` and the packages into `dist/` |

A Luau add-on's packages are in `wally.toml`; to remove one, delete its lines there and run `mise run install`. Services an add-on starts are listed in `src/app/server/Main.server.luau`. Reflex and Flamework Components are roblox-ts choices.

## Removing an add-on

There's no command to remove one; the sections above list what each touches. Two things help:

- **See exactly what it changed.** Create two games with the same flags, one without the add-on, and compare them: `pnpm create baseplate /tmp/with --no-git --no-install --data lapis`, the same without `--data lapis`, then `diff -r /tmp/with /tmp/without`.
- **Finish the same way each time.** Delete the add-on's section in `AGENTS.md`, set its key under `baseplate.addOns` in `package.json` to `none`, and run `mise run check`.
