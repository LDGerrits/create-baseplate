---
title: UI
description: React or Vide components, stories, and checking them as pictures without Studio.
---

UI is React from `@rbxts/react`, or [Vide](#vide) with `--ui vide`. Each component worth looking at has a story beside it, `<component>.story.tsx`, in UI Labs' format, so it shows in the UI Labs plugin in Studio too.

- `mise run ui` renders every story to a picture, offline, and prints each picture's path.
- `mise run ui -- --story <path>.story.tsx --actions '<json>'` clicks or types into a story and prints what it printed, to check a component responds.
- `mise run ui -- diff HEAD --story <path>.story.tsx` renders a story before and after your change, with a picture of the difference.

Animation uses `useMotion` from `@rbxts/pretty-react-hooks`, with Ripple. To inspect components live in Studio, the game can connect React DevTools.

## Vide

With `--ui vide`, the UI is [Vide](https://github.com/centau/vide) from `@rbxts/vide`, and the rest of this page holds: stories, `mise run ui`, actions and diffs work the same. What differs:

- **Components run once.** A component is a function that returns instances; it never re-renders. State lives in sources, read by calling them (`clicks()`), and a prop given a function updates when the sources it reads change: `` Text={() => `Clicks: ${clicks()}`} ``.
- **State and effects:** `source` makes state, `derive` derives a value, `effect` runs code when sources change, and `cleanup` disposes of what an effect or component set up. Props that change take a function (`clicks: () => number`), as `clicker-button.tsx` does.
- **Stories** use `CreateVideStory` from `@rbxts/ui-labs`, with `vide: Vide` in its options; a control arrives as a source.
- **Animation:** Vide's `spring`, in place of `useMotion` and Ripple.
- **Defaults:** Vide sets its own defaults on the instances it creates, such as a white background, unlike Roblox's; set the properties you rely on.
- **Strict mode:** in Studio, `start.tsx` turns on `Vide.strict`, which reports mistakes with readable errors; live servers skip it.
- **No DevTools or React lint rules.** React's packages and ESLint's react-hooks and react-x rules are gone. With `--state charm`, UI reads signals with `useSignalState` from `@rbxts/vide-charm`; Reflex has no Vide binding.
