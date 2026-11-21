---
title: Baseplate
description: The agent-ready way to start a roblox-ts game.
template: splash
hero:
  tagline: The agent-ready way to start a roblox-ts game. One command checks everything, tests and UI run without Studio, and hooks keep coding agents to the rules.
  actions:
    - text: Get started
      link: /getting-started/
      icon: right-arrow
    - text: How agents work in it
      link: /agents/
      variant: minimal
---

```sh
pnpm create baseplate my-game
```

Baseplate creates a Roblox game in TypeScript ([roblox-ts](https://roblox-ts.com)) that coding agents such as Claude Code, Codex, Cursor and Copilot can work on well:

- **One check.** `mise run check` formats, compiles, lints, builds the place and runs the tests, in about five seconds.
- **Tests and UI without Studio.** Tests run in ree, an emulated Roblox engine, in about a second; UI stories render to pictures offline.
- **Rules the agent can't skip.** Hooks run the check before an agent ends its turn and block edits to generated files.
- **The world in files.** Studio edits the map, and syncback writes it into readable JSON, apart from the code.
