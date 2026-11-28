---
"create-baseplate": minor
---

Games come with a typed signal and a cleanup object: Sleitnick's Signal (`@rbxutil/signal` in TypeScript, `sleitnick/signal` in Luau) and Janitor (`@rbxts/janitor`, `howmanysmall/janitor`). `AGENTS.md` and the `add-feature` skill show a system announcing a change with a signal and a service cleaning up what it starts for a tagged part with a Janitor. The check also refuses `BadgeService:AwardBadgeAsync` in client code, as it did `AwardBadge`.
