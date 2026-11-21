---
title: Add-ons
description: The UI library, and the libraries and tools the CLI can add for state, player data, entities, assets and release builds, or none.
---

The base game brings Flamework and React with a few small helpers they work well with, and leaves libraries for state, data and entities to you. Like create-t3-app, the CLI asks about each, offering the most used libraries or none, which is the default. It also asks which UI library to use:

| Question | Flag | Choices |
| --- | --- | --- |
| UI | `--ui` | `react` (default, [React](https://react.dev) for Roblox), `vide` ([Vide](https://github.com/centau/vide)) |
| Places | `--places` | `single` (default), `multi` |
| Client state | `--state` | `charm` ([Charm](https://github.com/littensy/charm)), `reflex` ([Reflex](https://github.com/littensy/reflex), no longer updated), `none` |
| Player data | `--data` | `profilestore` ([ProfileStore](https://github.com/MadStudioRoblox/ProfileStore)), `lapis` ([Lapis](https://github.com/nezuo/lapis)), `none` |
| Entities | `--entities` | `components` ([Flamework Components](https://flamework.fireboltofdeath.dev/docs/additional-modules/components)), `jecs` ([Jecs](https://github.com/Ukendio/jecs)), `none` |
| Assets | `--assets` | `asphalt` ([Asphalt](https://github.com/jackTabsCode/asphalt)), `none` |
| Release builds | `--release` | `darklua` ([Darklua](https://darklua.com)), `none` |

```sh
pnpm create baseplate my-game --state charm --data profilestore --entities components
```

Each add-on arrives wired in and tested, with a section in the game's `AGENTS.md` that tells agents how to use it:

- **Places:** with `multi`, the game is laid out as [Rogen](https://github.com/LDGerrits/rogen) does for roblox-ts: the shared code in `projects/common/src`, and a lobby and a game in `projects/`, each with its own entry scripts, world, tests and Rogen config. `mise run check` builds and tests every place; Studio commands name one: `mise run dev lobby`.
- **UI:** with Vide, the example UI, its story, the lint rules and `AGENTS.md`'s UI section are Vide's, and React's packages are gone.
- **State:** the clicker's controller keeps its count in the library, and the UI reads it from there. With Vide, Charm comes with its Vide binding; Reflex has none, so the CLI refuses Reflex with Vide.
- **Player data:** `PlayerDataService` loads each player's data when they join and saves it when they leave, with specs against a mock store. Studio saves to a mock store too.
- **Entities:** a part tagged `Spinner` in the world spins, with an end-to-end test; with Jecs, the system has its own spec.
- **Assets:** files in `assets/` upload to Roblox with `mise run assets`, which writes their IDs as typed code: `assets.icons.coin` for `assets/icons/coin.png`. You set who owns the uploads, your account or a group, in `asphalt.toml`, and the key in `.env`. `mise run check` fails while a file isn't uploaded, so a commit can't ship an asset the game can't load.
- **Release builds:** `mise run release` processes the compiled code with Darklua (minified, dead code removed, by the rules in `.darklua.json`), builds `build/release.rbxl` from it and runs the tests on that build, so what you publish is what was tested. The game's CI runs it too.
