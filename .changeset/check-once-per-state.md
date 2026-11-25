---
"create-baseplate": patch
---

A game's stop hook and commit hook no longer rerun the check on files it already passed on. The check records the state it passed (in the worktree's git folder, never committed); the stop hook skips when the files are the same, and the commit hook when what is staged is the same, so a check, a stop and a commit of one state cost one check, not three. A commit that stages only Markdown skips the check too. A pass of the working tree never lets a different staged state through: the commit hook compares the index, not the files on disk.
