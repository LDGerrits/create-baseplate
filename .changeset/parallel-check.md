---
"create-baseplate": patch
---

`mise run check` runs the steps that don't need each other's result at the same time, and in a multi-place game the places too, so the slowest step bounds it: about 3 seconds instead of 7 (TypeScript and Luau alike). It prints only the output of a step that failed, in a fixed order, then one line saying how it went. `mise run ci` is the same list of steps without the fixes (`scripts/check.ts`), where it used to be a copy. The tooling's own type-check and tests (of `scripts/` and `.agents/hooks/`) run only when those files changed since they last passed, and always on CI.
