---
"create-baseplate": patch
---

Claude Code's deny rules in a game now cover `.env.development`, `.env.production`, `.env.staging`, `.env.test`, `.env.dev`, `.env.prod` and `.env.*.local` as well as `.env` and `.env.local`; only `.env.example` stays readable. The guard hook already blocked every variant for all tools.
