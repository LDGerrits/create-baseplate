---
"create-baseplate": patch
---

A new game's agent files are leaner. Rogen's stop hook, `.agents/hooks/rogen-check.mjs`, which nothing ran, is gone. `AGENTS.md` names each skill once, in its skills list, and its "Adding a feature" section is now "Server and client", holding only the rules; the edit-world and drive-studio skills no longer repeat how to run the tools through mise. A new game also leaves out the tests of Baseplate's own hooks and scripts (about 2,000 lines): Baseplate runs them in every game its CI creates, and `BASEPLATE_TOOLING_TESTS=1` keeps them in a game.
