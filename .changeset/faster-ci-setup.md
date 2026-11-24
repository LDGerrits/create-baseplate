---
"create-baseplate": patch
---

A game's CI installs the software Vulkan driver for UI pictures without refreshing apt's package lists first, unless the install needs it, which takes about 15 seconds off each run.
