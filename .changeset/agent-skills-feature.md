---
"create-baseplate": minor
---

`mise run feature <name>` starts a feature: its network file, a service with every client-to-server event behind `rateLimit` and a spec, a controller, and their imports in the entry scripts (in a multi-place game, in the shared code, or in one place when you name it). New `add-feature`, `release` and `upgrade` skills tell agents how to build a feature, make a release ready for the user to publish, and handle a Renovate update or a `.baseplate-new` file.
