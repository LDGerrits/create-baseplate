---
"create-baseplate": patch
---

Cursor's hooks now start through `.agents/hooks/run` like every other agent's, so when mise can't be found the guard still blocks publishing and Studio's live tools in Cursor, instead of letting them through. On Windows this needs `sh` on the PATH Cursor's PowerShell uses (Git for Windows' `usr\bin`).
