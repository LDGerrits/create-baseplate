---
"create-baseplate": minor
---

A TypeScript game now ships `rateLimit` and `rateLimitFunction` (`src/platform/network/server/rate-limit.ts`), Flamework middleware that drops a player's client-to-server event, or cancels a function call, when it comes too soon after the last. `mise run feature` gives its event `rateLimit` instead of a `trusts-client` mark, and the check's message for an unguarded remote names it. Agents wrote this middleware by hand in every recorded session, and Flamework has none.
