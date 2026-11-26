---
"create-baseplate": patch
---

The guard hook blocks publishing however it's asked for: `mise run --quiet publish`, `mise r publish`, `mise publish`, `mise tasks run publish`, `sh -c "mise run publish"` and `node publish.ts` from another folder got past it before. A commit message that mentions publishing still goes through.
