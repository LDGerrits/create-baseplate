---
title: UI
description: React or Vide components, stories, and checking them as pictures without Studio.
---

In a TypeScript game, UI is React from `@rbxts/react`, or [Vide](#vide) with `--ui vide`. A [Luau game](/luau/) starts with Vide, and takes react-lua from Wally with `--ui react`, written with `React.createElement`. A new game mounts no UI: the `build-ui` skill (`.agents/skills/build-ui/SKILL.md`) shows how to mount a root. Each component worth looking at has a story beside it, `<component>.story.tsx`, in UI Labs' format, so it shows in the UI Labs plugin in Studio too. In a Luau game, stories are `<Component>.story.luau`; the commands below are the same.

- `mise run ui` renders every story to a picture, offline, and prints each picture's path.
- `mise run ui -- --story <path>.story.tsx --actions '<json>'` (`.story.luau` in a Luau game) clicks or types into a story and prints what it printed, to check a component responds.
- `mise run ui -- diff HEAD --story <path>.story.tsx` (`.story.luau` in a Luau game) renders a story before and after your change, with a picture of the difference.
- Add `--viewport 320x240`, or any size, to any of these to render on a smaller or larger screen.

Animation uses `useMotion` from `@rbxts/pretty-react-hooks`, with Ripple; a Luau game with React uses Ripple's own React hooks. To inspect components live in Studio, a TypeScript game can connect React DevTools.

## Vide

With `--ui vide`, and in a Luau game by default, the UI is [Vide](https://github.com/centau/vide), from `@rbxts/vide` (in a Luau game, `Packages.Vide` from Wally, built with `Vide.create`), and the rest of this page holds: stories, `mise run ui`, actions and diffs work the same. What differs:

- **Components run once.** A component is a function that returns instances; it never re-renders. State lives in sources, read by calling them (`clicks()`), and a prop given a function updates when the sources it reads change: `` Text={() => `Clicks: ${clicks()}`} ``.
- **State and effects:** `source` makes state, `derive` derives a value, `effect` runs code when sources change, and `cleanup` disposes of what an effect or component set up. Props that change take a function (`clicks: () => number`).
- **Stories** use `CreateVideStory` from `@rbxts/ui-labs` (in a Luau game, from `DevPackages.UILabs`), with `vide: Vide` in its options; a control arrives as a source.
- **Animation:** Vide's `spring`, in place of `useMotion` and Ripple (in a Luau game, `useSpring` and `useMotion` from vide-ripple).
- **Defaults:** Vide sets its own defaults on the instances it creates, such as a white background, unlike Roblox's; set the properties you rely on.
- **Strict mode:** in Studio, set `Vide.strict` where the root is mounted, which reports mistakes with readable errors; live servers skip it.
- **No DevTools or React lint rules** (in a TypeScript game). React's packages and ESLint's react-hooks and react-x rules are gone. With `--state charm`, UI reads signals with `useSignalState` from `@rbxts/vide-charm` (`VideCharm` in a Luau game); Reflex has no Vide binding.
