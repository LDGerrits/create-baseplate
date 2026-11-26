---
"create-baseplate": patch
---

In a multi-place Luau game with Darklua, `mise run release` processes each place's code (`projects/<place>/src/`, the shared code's included) and no longer runs Darklua over the places' worlds, builds and tests.
