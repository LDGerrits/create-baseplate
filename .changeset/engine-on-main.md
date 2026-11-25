---
"create-baseplate": patch
---

A game's CI runs its specs in real Roblox (the engine job) only on main and when run by hand, not on every pull request, so pull requests stay fast and don't spend the Open Cloud quota or the test place's DataStores.
