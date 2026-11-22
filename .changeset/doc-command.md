---
"create-baseplate": minor
---

`create-baseplate doc [topic]` prints a page of Baseplate's docs as Markdown, the version it ships, and lists the topics without one; `--json` for agents. In a game, `mise run doc <topic>` runs it at the version `package.json`'s `baseplate.version` pins, and `AGENTS.md` points agents to it. `create-baseplate doc` no longer creates a game in a folder named `doc`; write `./doc` for that.
