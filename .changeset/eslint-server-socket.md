---
"create-baseplate": patch
---

In a TypeScript game, the edit hook's ESLint server no longer deletes the socket of the server that replaced it. When a server replied stale and a new one started at once, the old one's exit removed the new one's socket, and the new one went unreachable until its idle timeout, which then removed the next one's.
