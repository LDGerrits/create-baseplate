---
title: Add-ons
description: The libraries the CLI can add for state, player data and entities, or none.
---

The base game brings Flamework and React with a few small helpers they work well with, and leaves libraries for state, data and entities to you. Like create-t3-app, the CLI asks about each, offering the most used libraries or none, which is the default:

| Question | Flag | Choices |
| --- | --- | --- |
| Client state | `--state` | `charm` ([Charm](https://github.com/littensy/charm)), `reflex` ([Reflex](https://github.com/littensy/reflex), no longer updated), `none` |
| Player data | `--data` | `profilestore` ([ProfileStore](https://github.com/MadStudioRoblox/ProfileStore)), `lapis` ([Lapis](https://github.com/nezuo/lapis)), `none` |
| Entities | `--entities` | `components` ([Flamework Components](https://flamework.fireboltofdeath.dev/docs/additional-modules/components)), `jecs` ([Jecs](https://github.com/Ukendio/jecs)), `none` |

```sh
pnpm create baseplate my-game --state charm --data profilestore --entities components
```

Each add-on arrives wired in and tested, with a section in the game's `AGENTS.md` that tells agents how to use it:

- **State:** the clicker's controller keeps its count in the library, and the UI reads it from there.
- **Player data:** `PlayerDataService` loads each player's data when they join and saves it when they leave, with specs against a mock store. Studio saves to a mock store too.
- **Entities:** a part tagged `Spinner` in the world spins, with an end-to-end test; with Jecs, the system has its own spec.
