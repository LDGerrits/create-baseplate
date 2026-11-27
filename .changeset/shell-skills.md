---
"create-baseplate": patch
---

The edit hook now names the skill for a file an agent writes from the shell (`cat > file <<EOF`), which the agent tools' path rules don't see, once a session; and after Claude Code or Gemini CLI compacts the conversation, each skill is named again.
