---
name: build-ui
description: Build or change the game's UI and look at it. Use when adding or editing a React view, a story, or a feature's UI hook, or when asked what the UI looks like.
---

# Build UI

UI is React function components from `@rbxts/react`, in two parts:

- **Views** are the `.tsx` files in a feature's `client/` folder. A view takes its data and callbacks as props and renders them; `src/features/clicker/client/clicker-button.tsx` is the example. ESLint keeps Flamework, Charm atoms, controllers and hooks out of views.
- **The feature's hook**, `client/use-<feature>.ts`, connects views to the game: it reads atoms with `useAtom`, gets controllers with `Dependency<MyController>()`, and returns values and callbacks. `src/app/client/app.tsx` calls each feature's hook and passes what it returns to the feature's top view, as with `useClicker` and `ClickerButton`.

## Steps

1. Write or change the view. Everything it shows or does comes in through props.
2. Give each view a story beside it, `<view>.story.tsx`, in UI Labs' React format. Copy `clicker-button.story.tsx`, and add a control for each prop worth varying: a long name, an empty list, a large number.
3. Connect the view through the feature's hook, and render it from `app.tsx` if it's a top-level view.
4. Run `mise run ui`. It renders every story with rur, offline, and prints each picture's path; `--filter <name>` renders only matching stories.
5. Open each picture you changed and look at it: text cut off, overlap, alignment, the empty state. A story that renders without errors can still look wrong. Fix it and render again until it looks right.
6. Run `mise run check`.

## Notes

- `mise run ui` needs Roblox Studio's fonts, or rur draws no text. On Windows rur finds them; from WSL the script finds the newest Windows Studio. Elsewhere, set `RUR_ROBLOX_CONTENT` to a copy of Studio's `content` folder.
- A story renders the view inside a `Frame`, so a view whose root is a `ScreenGui` draws nothing. Stories render the views below it.
- rur can also click: `rur-native render --rojo game.project.json --story <compiled story>.luau --dir <out> --actions '[{"type":"click","node":"TextButton","t":0.3}]'`, and with `--mode play --run-context loopback --player Tester` the story runs on a client against the real server. The compiled story is under `out/`. See rur's `docs/stories.md` for the action types.
