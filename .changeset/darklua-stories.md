---
"create-baseplate": patch
---

`--release darklua`: `mise run release` leaves the UI stories out of `dist/`. They were processed into it, and `mise run check` then tried to render the minified copies and failed until `dist/` was deleted.
