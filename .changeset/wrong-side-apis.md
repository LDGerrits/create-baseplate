---
"create-baseplate": patch
---

A game's check now fails on a Roblox API used on the wrong side: client-only ones (`Players.LocalPlayer`, `UserInputService`, `RunService.RenderStepped`, `StarterGui:SetCore` and others) in `server/` code, and server-only ones (`DataStoreService`, `MessagingService`, `MemoryStoreService`, `ServerStorage`, `ServerScriptService`, `HttpService:RequestAsync`, `BadgeService:AwardBadge`, `MarketplaceService.ProcessReceipt` and others) in `client/` code. Both apply in `shared/`, where a call guarded by `RunService` is allowed with a disable comment (TypeScript) or `-- guarded: <why>` (Luau). TypeScript games use ESLint rules, Luau games the source check.
