---
"create-baseplate": minor
---

A TypeScript game now ships `rateLimit` and `rateLimitFunction` (`src/platform/network/server/rate-limit.ts`), Flamework middleware that lets a player's client-to-server events through once every so many seconds on average, with a burst of three so network jitter isn't dropped, and drops the rest (a function call is cancelled). `mise run feature` gives its event `rateLimit` instead of a `trusts-client` mark, and the check's message for an unguarded remote names it. Agents wrote this middleware by hand in every recorded session, and Flamework has none.
