---
title: Add-ons
description: The libraries the CLI can add for state, player data and entities, or none.
---

The base game brings Flamework and React with a few small helpers they work well with, and leaves libraries for state, data and entities to you. Like create-t3-app, the CLI asks about each, offering the most used libraries or none, which is the default. It also asks which UI library to use:

| Question | Flag | Choices |
| --- | --- | --- |
| UI | `--ui` | `react` (default, [React](https://react.dev) for Roblox), `vide` ([Vide](https://github.com/centau/vide)) |
| Client state | `--state` | `charm` ([Charm](https://github.com/littensy/charm)), `reflex` ([Reflex](https://github.com/littensy/reflex), no longer updated), `none` |
| Player data | `--data` | `profilestore` ([ProfileStore](https://github.com/MadStudioRoblox/ProfileStore)), `lapis` ([Lapis](https://github.com/nezuo/lapis)), `none` |
| Entities | `--entities` | `components` ([Flamework Components](https://flamework.fireboltofdeath.dev/docs/additional-modules/components)), `jecs` ([Jecs](https://github.com/Ukendio/jecs)), `none` |

```sh
pnpm create baseplate my-game --state charm --data profilestore --entities components
```

Each add-on arrives wired in and tested, with a section in the game's `AGENTS.md` that tells agents how to use it:

- **UI:** with Vide, the example UI, its story, the lint rules and `AGENTS.md`'s UI section are Vide's, and React's packages are gone.
- **State:** the clicker's controller keeps its count in the library, and the UI reads it from there. With Vide, Charm comes with its Vide binding; Reflex has none, so the CLI refuses Reflex with Vide.
- **Player data:** `PlayerDataService` loads each player's data when they join and saves it when they leave, with specs against a mock store. Studio saves to a mock store too.
- **Entities:** a part tagged `Spinner` in the world spins, with an end-to-end test; with Jecs, the system has its own spec.
