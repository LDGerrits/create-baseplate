---
"create-baseplate": patch
---

A game's checks no longer leave temp files behind: the tests of `mise run feature` remove the folders they make, and the edit hook keeps Node's compile cache in `node_modules/.cache` instead of the system temp folder, where each checkout added about two thousand files that nothing removed.
