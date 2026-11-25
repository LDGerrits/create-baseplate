---
"create-baseplate": patch
---

A game's `mise.lock` now lists the tools' builds for Intel Macs and Windows on ARM too, so mise installs the tools that ship for them. ree and ror, which run the tests and render 3D, have no build for those platforms, nor for Linux on ARM: `mise run test` can't run there.
