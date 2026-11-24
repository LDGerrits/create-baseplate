---
"create-baseplate": minor
---

A Luau game now starts as small as `rojo init`'s: the clicker example, the UI root and its end-to-end tests are gone. `src/app/server/Main.server.luau` and `src/app/client/Start.luau` start with empty lists of services and controllers, `src/features/` appears with your first `mise run feature <name>`, and the world keeps a baseplate, a spawn and the lighting. React or Vide stays installed, and `AGENTS.md` says how to mount a UI root; Charm and Vide add only their packages and their notes in `AGENTS.md`. The check, the hooks, the skills and the test and story runners are unchanged, and pass with nothing to run.
