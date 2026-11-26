---
"create-baseplate": patch
---

Agents often write files from the shell (heredocs, sed, python) rather than with their edit tools, and then got no feedback until the end of the turn. The edit hook now also runs after each shell command, on the game's files it wrote: it formats them, applies the lint fixes, and hands back the problems left. When no language server saw the write, because a shell command made it or the agent tool has none, it type-checks too, type errors first: the compiler in a TypeScript game (about half a second), luau-lsp on the written files in a Luau game, after writing the sourcemap when they're new modules. A command that runs a `mise` task reports for itself and is left alone; one that writes nothing costs a tenth of a second.
