---
"create-baseplate": patch
---

In a TypeScript game, the hook that formats and lints each file an agent edits takes about 0.2 seconds instead of 1.9 after the first edit. The first edit starts a small server that keeps ESLint loaded (`.agents/hooks/eslint-server.ts`, one per project, stopped after ten idle minutes); it restarts when anything but the edited file changed, so it never answers from stale types, and the hook lints in its own process whenever the server can't be used.
