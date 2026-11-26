---
"create-baseplate": patch
---

With Asphalt, the guard hook blocks edits to the module it writes: in a Luau game it watched the wrong path, and in a TypeScript game it didn't watch `assets.luau` and `assets.d.ts` at all. With Darklua, it blocks edits to `dist/` and `release.project.json` in both languages; a Luau game without Darklua no longer names them.
