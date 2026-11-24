---
"create-baseplate": minor
---

The guard now covers Roblox Studio's MCP server: it blocks `open_cloud_invoke`, and `execute_luau` that reaches DataStores, MemoryStores, messaging or HTTP, in every agent tool. The check fails on unions, `SurfaceAppearance` and wrap layers, which Open Cloud's place publishing doesn't update. AGENTS.md asks agents to look at what's there before changing it, and to follow the code where AGENTS.md disagrees with it.
