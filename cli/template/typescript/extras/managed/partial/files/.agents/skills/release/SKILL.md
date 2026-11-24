---
name: release
description: Prepare the game's code for a release or a publish, and tell the user how to ship it. Use when asked to release, publish, deploy, ship a version or tag.
---

# Prepare a release

You don't publish: the place is published from Studio, where its world is, and publishing replaces the game players join. You make the commit ready, and the user ships it.

1. **Start from a clean base.** `git status` shows nothing you didn't mean to commit, and the branch has the latest main (`git fetch`, then merge it in).
2. **Run the full check:** `mise run check` (`mise run ci` is the same without writing fixes).
3. **Look at what the UI does.** The tests don't see a layout that looks wrong. Render the stories you changed (`mise run ui`), and play it in Studio when the change is about feel (`drive-studio` skill).
4. **Publishing is the user's.** Tell them which commit is ready. They sync its code into their place with `mise run dev` and the Rojo plugin, look it over in Studio, and publish from Studio.
5. **Say what changed for players**, in a few lines, for the release notes: what they will see and do differently, and anything that resets or migrates their data.
