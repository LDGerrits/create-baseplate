---
title: UI
description: React components, stories, and checking them as pictures without Studio.
---

UI is React from `@rbxts/react`. Each component worth looking at has a story beside it, `<component>.story.tsx`, in UI Labs' format, so it shows in the UI Labs plugin in Studio too.

- `mise run ui` renders every story to a picture, offline, and prints each picture's path.
- `mise run ui -- --story <story> --actions '<json>'` clicks or types into a story and prints what it printed, to check a component responds.
- `mise run ui -- diff HEAD --story <story>` renders a story before and after your change, with a picture of the difference.

Animation uses `useMotion` from `@rbxts/pretty-react-hooks`, with Ripple. To inspect components live in Studio, the game can connect React DevTools.
