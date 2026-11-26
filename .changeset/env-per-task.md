---
"create-baseplate": patch
---

Each task that reads `.env` passes on only its own variables (`scripts/with-env.ts`): the tests never see the publish key, nor publishing the test key, and `mise run ui` sees neither. A variable set in the environment, as in CI, wins over `.env`. In the game's workflows, the build runs in a step of its own (`mise run publish:build`, and `mise run compile` before the engine specs), so the step that holds a key runs only the upload or the specs.
