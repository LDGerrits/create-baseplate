---
"create-baseplate": patch
---

When the agent guard can't run, because mise is missing or the hook fails, it still blocks Studio's live tools and publishing instead of letting them through. Other calls still go through.
