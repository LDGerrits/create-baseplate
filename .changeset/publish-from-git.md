---
"create-baseplate": minor
---

Games publish from git. `mise run publish` builds the place and publishes it through Open Cloud, and the new `publish.yml` workflow publishes main to a dev place, a version tag to a stable place, and the same tag to the live game once someone approves it. Agents can't publish: a hook stops them. The `edit-world` skill now covers art and unions saved as `.rbxm`, source art in Git LFS, placing many copies of one asset with markers, and what `forge restart` drops.
