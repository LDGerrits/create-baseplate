---
"create-baseplate": patch
---

A game's CI installs Mesa's Vulkan driver in the background and caches its packages by runner image, so the story pictures cost the check a few seconds instead of up to a minute on a slow mirror. The game's `scripts/mesa.sh` does it, for `ci.yml` and `copilot-setup-steps.yml`.
