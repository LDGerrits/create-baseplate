---
"create-baseplate": patch
---

Rules a game's `AGENTS.md` only asked for are now checked, and those lines are gone from it: file names are kebab-case in TypeScript and PascalCase in Luau; a lint disable (`eslint-disable`, `selene: allow`) and a Luau `:: any` cast say why after ` -- `; in TypeScript, ESLint names the Roblox API to use for a JavaScript global such as `console`, `setTimeout`, `JSON` or `Object`. Luau's `mise run feature` takes a camelCase name: `dailyReward` makes `DailyRewardService` in `features/dailyreward/`.
