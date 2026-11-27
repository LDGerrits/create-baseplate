---
"create-baseplate": patch
---

`create-baseplate --json` says whether the game's check ran on its first commit (`checked`): with `--no-install` the commit is made before the hooks that run it are set up. In a game, the check records a pass only for files it saw whole: when files keep changing while it runs, it fails and says to run it again, instead of the stop hook recording a pass anyway. The TypeScript ProfileStore add-on no longer kicks a player whose session it releases itself, so releasing before a teleport keeps them in the game. A Luau game's package install keeps its progress in one marker, so an interrupted run can't leave the packages untyped. Publishing to prod waits for a stable publish that was cancelled, not only one that failed.
