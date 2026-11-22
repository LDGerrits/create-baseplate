---
"create-baseplate": minor
---

Make Luau games: the first question is now the language, `--language typescript` (roblox-ts, the default) or `--language luau`. A Luau game has its own template with the tools Luau developers use: Wally for packages, StyLua, Selene, and luau-lsp type-checking every file in strict mode against every instance in the game, world included. It keeps the same agent setup as a roblox-ts game: one `mise run check`, the hooks and skills, Jest specs and end-to-end tests in ree, story pictures in rur, and the commit hook. Services and controllers are plain modules, and remotes are declared once with a `t` check and taken by the server only through a rate limit. Its add-on questions offer what Luau games use: React or Vide, one place or several, Charm, ProfileStore or Lapis, Jecs, Asphalt and Darklua. Games record their language in `package.json`, so `create-baseplate sync` updates their agent files from the right template; games made before this are TypeScript.
