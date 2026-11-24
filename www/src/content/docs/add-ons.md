---
title: Add-ons
description: The UI library, the place layout, and the libraries and tools the CLI can add for state, player data, entities, assets and release builds; what each wires in, and how to take it out.
---

The base game brings Flamework and React with a few small helpers they work well with, and asks about libraries for state, data and entities. Like create-t3-app, the CLI asks about each, offering the most used libraries or none. None is the default, except for state: Reflex in TypeScript (Charm with Vide, which Reflex doesn't support) and Charm in Luau. It also asks which UI library to use, how many places, and how much of the place Rojo manages:

| Question | Flag | Choices |
| --- | --- | --- |
| Language | `--language` | `typescript` (default, roblox-ts), `luau` |
| UI | `--ui` | `react` (default, [React](https://react.dev) for Roblox), `vide` ([Vide](https://github.com/centau/vide)) |
| Places | `--places` | `single` (default), `multi` |
| Managed | `--managed` | `full` (default), `partial` |
| Client state | `--state` | `charm` ([Charm](https://github.com/littensy/charm); Luau's default), `reflex` ([Reflex](https://github.com/littensy/reflex); TypeScript only, its default), `none` |
| Player data | `--data` | `profilestore` ([ProfileStore](https://github.com/MadStudioRoblox/ProfileStore)), `lapis` ([Lapis](https://github.com/nezuo/lapis)), `none` |
| Entities | `--entities` | `components` ([Flamework Components](https://flamework.fireboltofdeath.dev/docs/additional-modules/components); TypeScript only), `jecs` ([Jecs](https://github.com/Ukendio/jecs)), `none` |
| Assets | `--assets` | `asphalt` ([Asphalt](https://github.com/jackTabsCode/asphalt)), `none` |
| Release builds | `--release` | `darklua` ([Darklua](https://darklua.com)), `none` |

```sh
pnpm create baseplate my-game --state charm --data profilestore --entities components
```

Each add-on arrives wired in and tested, with a section in the game's `AGENTS.md` that tells agents how to use it. CI creates games with each choice alone, every question answered together, and enough combinations that every two choices meet in some game. The CLI refuses only what can't work: Reflex with Vide, Darklua with `--managed partial` (nothing publishes from git to process), and a choice the language doesn't have (Reflex and Flamework Components in a Luau game). [Folder layout](/layout/) lists the files each one adds.

## UI: Vide

`--ui vide` swaps React for [Vide](https://github.com/centau/vide), fine-grained reactivity without re-renders. The JSX settings in `tsconfig.json` and `AGENTS.md`'s UI section, which shows how to mount a root, become Vide's; React, its hooks, Ripple, React DevTools and React's lint rules go. [UI](/ui/#vide) has the differences. Going back to React means changing those settings and the UI's code by hand: create a game without the flag and compare.

## Places: several

`--places multi` lays the game out as [Rogen](https://github.com/LDGerrits/rogen) does for roblox-ts: shared code in `projects/common/src`, and a lobby and a game in `projects/`, each with its own entry scripts, world, end-to-end tests, Rogen config and `tsconfig.<place>.json`. `mise run check` builds and tests every place; Studio commands name one: `mise run dev lobby`. The other add-ons follow it, so Asphalt writes its code into the shared code. There's no switch back; to move to one place, create a game without the flag and move the features into it.

## Managed: partial

By default Rojo manages the whole place, as Roblox's [fully managed](https://create.roblox.com/docs/projects/rojo/fully-managed) workflow has it: the map and lighting are files in `world/`, Studio's edits sync back into them, the game builds from git and `mise run publish` uploads the tested build. `--managed partial` is Roblox's [partially managed](https://create.roblox.com/docs/projects/rojo/partially-managed) workflow: Studio owns the place and its world, and files hold only the code. The game has no `world/`, no `mise run sync`, no `edit-world` skill and no world types, and nothing publishes from the command line or CI: `mise run dev` serves the code, you connect the Rojo plugin in Studio to it, and you publish from Studio. Instances in the workspace aren't typed, so code reaches them with `WaitForChild` or `FindFirstChild` and checks what it finds. The check and the tests are the same, and run in a place made of the code alone. It combines with every other choice except `--release darklua`, which the CLI refuses; with `--places multi`, each place is still a folder of code. To go from `partial` to `full`, create a game with `full` and move the code into it.

## State: Charm

`--state charm` adds [Charm](https://github.com/littensy/charm), whose signals hold client state: a controller owns its signals, and UI reads one with `useSignalState` from `@rbxts/react-charm` (with Vide, `@rbxts/vide-charm`). Packages: `@rbxts/charm` and its UI binding. It adds no files, only its section of `AGENTS.md`.

To remove it, `pnpm remove @rbxts/charm @rbxts/react-charm` (`@rbxts/vide-charm` with Vide) and delete its section from `AGENTS.md`.

## State: Reflex

`--state reflex` adds [Reflex](https://github.com/littensy/reflex), one store for the client made of a slice per feature. Controllers change it through its actions, and UI reads it with `useSelector` inside a `ReflexProvider`. Packages: `@rbxts/reflex`, `@rbxts/react-reflex`. It adds no files, only its section of `AGENTS.md`, which shows how to write the store (`src/store/client/client-store.ts`) with the first slice. Reflex has no Vide binding, so a Vide game takes Charm by default.

To remove it, delete `src/store/` if you wrote it and its section of `AGENTS.md`, and `pnpm remove @rbxts/reflex @rbxts/react-reflex`.

## Player data: ProfileStore

`--data profilestore` adds `PlayerDataService` in `src/features/player-data/server/`: it loads each player's data with [ProfileStore](https://github.com/MadStudioRoblox/ProfileStore) when they join and saves it when they leave, with session locking (another server taking the session kicks the player to rejoin). Other services use `get(userId)` and `update(userId, fn)`. New fields go in `player-data.ts`; `Reconcile` gives old saves the new defaults. Studio and the specs use ProfileStore's mock store. Package: `@rbxts/profile-store`; the service is imported in `main.server.ts`.

To remove it, delete `src/features/player-data/`, its import in `main.server.ts`, and `pnpm remove @rbxts/profile-store`.

## Player data: Lapis

`--data lapis` adds the same `PlayerDataService`, on [Lapis](https://github.com/nezuo/lapis): validated documents, with migrations for data saved before a field existed. Lapis rejects data `validate` doesn't accept. Studio and the specs use `@rbxts/lapis-mockdatastore`; specs that load data skip in an Open Cloud session, where Lapis doesn't move without physics. Packages: `@rbxts/lapis`, `@rbxts/lapis-mockdatastore`.

To remove it, delete `src/features/player-data/`, its import in `main.server.ts`, and `pnpm remove @rbxts/lapis @rbxts/lapis-mockdatastore`.

## Entities: Flamework Components

`--entities components` adds `SpinnerComponent` (`src/features/spinner/server/spinner-component.ts`), a [Flamework Components](https://flamework.fireboltofdeath.dev/docs/additional-modules/components) class that spins each part tagged `Spinner`; `world/Workspace/Spinner.model.json` is one (with `--managed partial`, the test makes its own part), and `tests/e2e/spinner.luau` checks it turns. Package: `@flamework/components`; the component is imported in `main.server.ts`.

To remove it, delete `src/features/spinner/`, the model, the end-to-end test and the import, and `pnpm remove @flamework/components`.

## Entities: Jecs

`--entities jecs` adds `SpinnerService`, which makes a [Jecs](https://github.com/Ukendio/jecs) entity for each part tagged `Spinner` and runs `spinnerSystem` each frame. Systems are functions of the world and the time, so `spinner-system.spec.ts` runs one on its own world. The same world part and end-to-end test come with it (with `--managed partial`, the test makes its own part). Package: `@rbxts/jecs`.

To remove it, delete `src/features/spinner/`, the model, the end-to-end test and the import in `main.server.ts`, and `pnpm remove @rbxts/jecs`.

## Assets: Asphalt

`--assets asphalt` adds [Asphalt](https://github.com/jackTabsCode/asphalt): files in `assets/` upload to Roblox with `mise run assets`, which writes their IDs to `src/shared/assets.luau`, typed by `assets.d.ts`: `assets.icons.coin` for `assets/icons/coin.png`. You set who owns the uploads, your account or a group, in `asphalt.toml`, and the key `ASPHALT_API_KEY` in `.env`. `mise run check` fails while a file isn't uploaded, so a commit can't ship an asset the game can't load. Files: `asphalt.toml`, `assets/`, `scripts/assets.ts`; the tool and the `assets` task in `mise.toml`, and a step in `check` and `ci`.

To remove it, delete those files and the generated ones, the Asphalt lines in `mise.toml` (then `mise lock`), the key in `.env.example`, and the generated files' entries in `biome.json`, `eslint.config.ts` and `.gitignore`.

## Release builds: Darklua

`--release darklua` adds `mise run release`: it processes the compiled code with [Darklua](https://darklua.com) into `dist/`, by the rules in `.darklua.json` (minified, dead code removed, locals renamed), builds `build/release.rbxl` from it and runs the tests on that build, so what you publish is what was tested. It runs when you publish (`mise run publish` and the publish workflow), not in the check or the game's CI, so it never slows down development. A partially managed game can't take it, since Studio publishes that game. When the tests pass in `check` and fail in `release`, a rule broke the code: remove it from `.darklua.json`. Files: `.darklua.json`, `scripts/darklua.ts`, `scripts/release-project.ts`; the tool and the `release` task in `mise.toml`.

To remove it, delete those files, the Darklua lines in `mise.toml` (then `mise lock`), `/dist` in `.gitignore`, and set the `publish` task in `mise.toml` back to depend on `build` and publish `build/game.rbxl`.

## In a Luau game

A [Luau game](/luau/) asks the same questions, with what Luau games use, and each choice does what its section above says, in Luau's files:

| Add-on | Packages (Wally) | Files |
| --- | --- | --- |
| `--managed partial` | | As in a TypeScript game: no `world/`, `sync` task, `edit-world` skill or publishing; the code alone is tested and typed |
| `--places multi` | | Rogen's Luau layout: `<place>.rogen.json` at the root, shared code in `projects/common/src`, each place in `projects/<place>/` (see [Luau games](/luau/#several-places)) |
| `--ui vide` | `centau/vide`, `littensy/vide-ripple`, in place of react-lua | Vide's section in `AGENTS.md` (mounting a root, `CreateVideStory`); the game starts without a UI |
| `--state charm` | `littensy/charm`, with `littensy/react-charm` or `littensy/vide-charm` | Charm's section in `AGENTS.md`: a controller keeps a signal, and the UI reads it |
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
