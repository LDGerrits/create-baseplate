---
"create-baseplate": patch
---

- In a local Claude Code session, the shell finds the project's tools by name (`rogen`, `ree`, `wally` and the rest): the session-start hook gives it mise's environment, as cloud sessions already had.
- `mise run check` lints through the edit hook's ESLint server when it is running, so a TypeScript check takes about a second instead of about three.
- Renovate brings ree, rur and ror in one update.
- The UI guidance moves from `AGENTS.md` into a `build-ui` skill, loaded when an agent builds, restyles or checks UI; `AGENTS.md` keeps a short UI section pointing to it.
- The README starts with what to do first, then the day-to-day commands, the layout and publishing; what the template gives an agent moves to the end.
