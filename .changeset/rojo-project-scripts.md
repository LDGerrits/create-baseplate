---
"create-baseplate": patch
---

A game's scripts that read and write Rojo project files (`game-project.ts`, `release-project.ts` and the Jest configs) share one module, `scripts/rojo-project.ts`. With `--places multi --release darklua` in Luau, a place's release now leaves out the shared code's specs as its test build does, instead of running them a second time. In TypeScript, the check runs itself again when any file changed after formatting, not only when ESLint fixed one.
