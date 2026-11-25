---
"create-baseplate": minor
---

Code in a game is organised in four layers, in both languages, and the check enforces them: `app/` (entry scripts), `features/<feature>/` (what the game could ship without), `game/<system>/` (always-on systems) and `platform/<module>/` (game-agnostic code). Imports only go down, features never import each other in a cycle, side folders (`server/`, `client/`, `shared/`) sit only at `app/<side>/` and `<layer>/<module>/<side>/`, and modules of `game/` and `platform/` have names, not `utils` or `helpers`. A Luau game's requires are read through its sourcemap. The player data add-ons write `game/player-data` (`game/playerdata` in Luau), Asphalt writes its IDs to `game/assets/shared`, and Reflex's store sits in `game/store/`.
