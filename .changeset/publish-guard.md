---
"create-baseplate": patch
---

The guard hook blocks publishing however it's asked for: `mise run --quiet publish`, `mise r publish`, `mise publish`, `mise tasks run publish`, `mise run 'publish'`, a pattern such as `mise run 'publi*'`, `sh -c "mise run publish"` and `node publish.ts` from another folder got past it before. It also blocks running `scripts/with-env.ts` by hand, which would hand `.env`'s keys to any command. A commit message that mentions publishing, or `publish` passed to a task after `--`, still goes through.
