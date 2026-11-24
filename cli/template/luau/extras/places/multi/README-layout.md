## Layout

The game has several places, laid out as [Rogen](https://github.com/LDGerrits/rogen) does for Luau:

```
projects/
  common/src/          code every place shares
    features/          each feature: server/, client/, shared/ (`mise run feature`)
  lobby/               a place: src/app (its entry scripts), world/, tests/e2e/
  game/                another place, laid out the same; runs the shared code's tests
lobby.rogen.json       each place's Rogen config: its source paths, shared and its own
game.rogen.json
wally.toml             the Roblox packages, shared by every place
```
