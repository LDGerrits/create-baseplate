---
"create-baseplate": minor
---

A TypeScript game's check now covers the Luau it keeps beside its TypeScript: `.luau` files in `src/` and the end-to-end tests in `tests/e2e` are formatted with StyLua, linted with Selene and type-checked with luau-lsp. The steps do nothing in a game without Luau files.
