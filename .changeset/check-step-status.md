---
"create-baseplate": patch
---

A game's check runs its steps through one shared, tested scheduler, `scripts/steps.ts`, in both languages. With `--verbose` it says which step a skipped one waited on ("not run, compile didn't pass"), and a step that names a step that doesn't exist in its `needs` is reported as not run, where it used to count as failed with no output.
