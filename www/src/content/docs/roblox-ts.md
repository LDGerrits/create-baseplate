---
title: roblox-ts is not JavaScript
description: What changes when TypeScript runs as Luau.
---

roblox-ts compiles TypeScript to Luau, so the code runs in Roblox, not Node or a browser. The compiler and ESLint catch most differences (`null`, `.length`, truthiness, `for...in`). These they don't explain:

- There's no Node, DOM or npm runtime. Use Roblox's APIs: `task.delay` for `setTimeout`, `print` for `console`, `HttpService:JSONEncode` for `JSON`. For `Object.keys` and the like, `import ObjectUtils from "@rbxts/object-utils"`. ESLint names the Roblox API for each JavaScript global an agent reaches for.
- Packages come from the `@rbxts` scope; a plain npm package won't run in Roblox.
- Check Roblox values with `typeIs` and `classIs`, and an instance with its children with `Flamework.createGuard<T>()`.

## Luau beside TypeScript

A hand-written `.luau` module in `src/` is copied to `out/` as it is, and TypeScript imports it through a `.d.ts` beside it that declares what it returns. A spec calls it through those types. The check formats such files with StyLua, lints them with Selene and type-checks them with luau-lsp (strict, the new type solver, Roblox's API types); in a game without any, those steps do nothing.
