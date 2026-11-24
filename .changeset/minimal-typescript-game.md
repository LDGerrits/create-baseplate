---
"create-baseplate": minor
---

A TypeScript game now starts as small as `rojo init`'s: Flamework ignited in the two entry scripts (`src/app/server/main.server.ts` and `src/app/client/main.client.ts`), no services, controllers or UI, and a world with a baseplate, a spawn and lighting. The clicker example, the UI root, `react-dev.ts` and the rate-limit middleware are gone, so there are no specs, end-to-end tests or stories until you add them. `mise run feature <name>` still starts a feature and imports it in the entry scripts. The check still fails on a client-to-server event with no middleware, now pointing you to Flamework middleware that rate-limits it, or to `// trusts-client: <why>`. `AGENTS.md`'s UI section shows how to mount a React or Vide root. `--state charm` and `--state reflex` add their packages and `AGENTS.md` section; `--ui vide` swaps the packages, the JSX settings and the lint config.
