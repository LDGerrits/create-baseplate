---
"create-baseplate": minor
---

Agents get lint feedback after each file edit, not only when they stop. A new hook, `.agents/hooks/edited.ts`, formats the edited file with Biome, applies ESLint's fixes to it and hands the lint problems left straight back to the agent, in Claude Code, Codex, GitHub Copilot and Gemini CLI; in Cursor it applies the fixes without a message. It leaves alone what the agent is still writing: an import not used yet stays, as does a `let` and a value import. It lints only the edited file, in two to three seconds, and leaves the compiler to the stop check.
