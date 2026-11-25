---
"create-baseplate": patch
---

A game's CI runs on main are no longer cancelled by a later push, so a version tag on a commit that is not main's newest still finds its CI result and publishes; only a pull request's older run is cancelled.
