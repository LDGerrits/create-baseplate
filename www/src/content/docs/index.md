---
title: Baseplate
description: The agent-ready way to start a Roblox game, in roblox-ts or Luau.
# Shown at / by src/pages/index.astro: as a draft, Starlight leaves that route alone, and this stays
# the home page's Markdown copy for agents (/index.md, first in llms.txt).
template: splash
draft: true
hero:
  tagline: The agent-ready way to start a Roblox game, in roblox-ts or Luau. One command checks everything, tests and UI run without Studio, and hooks keep coding agents to the rules.
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

Baseplate creates a Roblox game in TypeScript ([roblox-ts](https://roblox-ts.com)) or [Luau](/luau/) that coding agents such as Claude Code, Codex, Cursor, Copilot and Gemini CLI can work on well:

- **One check.** `mise run check` formats, compiles or type-checks, lints, builds the place, runs the tests and renders the UI stories, in about three seconds.
- **Tests and UI without Studio.** Tests run in ree, an emulated Roblox engine, in a few seconds; UI stories render to pictures offline.
- **Hooks that catch mistakes.** Hooks run the check before an agent ends its turn and block edits to generated files. They're guard rails, not a sandbox: keep the agent's permissions narrow too.
- **The world in files.** Studio edits the map, and syncback writes it into readable JSON, apart from the code.
