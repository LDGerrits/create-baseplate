---
"create-baseplate": patch
---

Luau games use lowercase folders, as Rogen's own starter does: `src/app`, `src/network` and `src/features/<feature>`, each with `server/`, `client/` and `shared/`, and routes spelled the same in `default.rogen.json`. Files keep their PascalCase names. A required module's path changes with its folder, such as `ServerScriptService.features.clicker.ClickerService`.
