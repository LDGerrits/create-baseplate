---
"create-baseplate": patch
---

Prod publishes from a tag even when the game has no stable target: before, a skipped stable job held prod back too. The docs now say most games need only dev and prod, and stable is for releases other people test first.
