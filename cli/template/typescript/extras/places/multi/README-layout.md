## Layout

The game has several places, laid out as [Rogen](https://github.com/LDGerrits/rogen) does for roblox-ts:

```
projects/
  common/src/            code every place shares, in the four layers:
    features/ game/ platform/   (app/ is each place's own)
  lobby/                 a place: default.rogen.json, src/app (its entry scripts), world/, tests/e2e/
  game/                  another place, laid out the same
tsconfig.<place>.json    compiles each place into out/<place>/
```
