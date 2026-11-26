---
"create-baseplate": patch
---

Renovate in a game no longer merges a minor update below 1.0 by itself (0.9 to 0.10 may change the API), and keeps `@rbxts/ripple` on 0.9, which `@rbxts/pretty-react-hooks` is built for.
