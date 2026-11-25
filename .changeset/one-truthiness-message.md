---
"create-baseplate": patch
---

A TypeScript game's lint reports a number or string used as a condition once, by `strict-boolean-expressions`, instead of also by `roblox-ts/lua-truthiness`, whose message told agents to turn the rule off in `eslint.config.ts`. The comment on the rule now says what roblox-ts does with `0`, `""` and `NaN`: it keeps JavaScript's falsiness by adding checks to the Luau.
