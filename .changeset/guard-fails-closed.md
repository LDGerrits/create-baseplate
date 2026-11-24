---
"create-baseplate": patch
---

When the agent guard can't run, because mise is missing or the hook fails, it still blocks Studio's live tools and publishing instead of letting them through. Other calls still go through.

The place check now warns about unions, `SurfaceAppearance`, wrap layers and editable images and meshes instead of failing: Open Cloud's place publishing doesn't update them, so after changing one, publish from Studio. In Cursor, the guard on MCP calls no longer refuses other MCP servers started with `npx`.
