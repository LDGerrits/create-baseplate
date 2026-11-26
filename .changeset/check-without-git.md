---
"create-baseplate": patch
---

`mise run check` passes in a game that isn't a git repo, such as one created with `--no-git`: the workflows step names the workflow files to actionlint, which otherwise looks for them through git.
