---
"create-baseplate": patch
---

`mise run check` and the hooks start faster: Node keeps the compiled code of the tools it loads (`NODE_COMPILE_CACHE` in `mise.toml`, under `node_modules/.cache`), and in a TypeScript game ESLint loads its config and plugins while the files are generated and formatted (`scripts/lint.ts`). A default game's check takes about 1.9 s instead of 2.5 s.
