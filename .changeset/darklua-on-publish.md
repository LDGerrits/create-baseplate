---
"create-baseplate": minor
---

Darklua (`--release darklua`) now runs only when the game publishes: `mise run publish` and the publish workflow build and test the release, and the game's CI no longer does on every push. A partially managed game can't take it, since Studio publishes that game.
