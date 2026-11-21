---
title: roblox-ts is not JavaScript
description: What changes when TypeScript runs as Luau.
---

roblox-ts compiles TypeScript to Luau, so the code runs in Roblox, not Node or a browser. The compiler and ESLint catch most differences (`null`, `.length`, truthiness, `for...in`). These they don't explain:

- There's no Node, DOM or npm runtime. Use Roblox's APIs: `task.delay` for `setTimeout`, `print` for `console`, `HttpService:JSONEncode` for `JSON`. For `Object.keys` and the like, use `@rbxts/object-utils`.
- Packages come from the `@rbxts` scope; a plain npm package won't run in Roblox.
- Check Roblox values with `typeIs` and `classIs`, and an instance with its children with `Flamework.createGuard<T>()`.
