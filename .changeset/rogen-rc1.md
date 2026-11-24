---
"create-baseplate": patch
---

Games use Rogen 2.0.0-rc.1. Its rules in `AGENTS.md` and its hook, `.agents/hooks/rogen-check.mjs`, are Rogen's own now, so `rogen write` no longer rewrites them, and Biome leaves the hook alone. A Luau game's routes are spelled `Server`, `Client` and `Shared`, like its folders, since Rogen now routes only a folder or `@` suffix spelled exactly as its key.
