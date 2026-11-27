---
name: build-ui
description: Build, restyle or check the game's UI: components, their stories and pictures, the UI root, small screens, clicks. Use for a HUD, a screen, a menu or a button, or when UI looks wrong.
---

# Build UI

React from `@rbxts/react`. The game starts with no UI mounted. To add one, write the root component (`src/app/client/app.tsx`, a `<screengui>` holding your components) and mount it from a controller that `main.client.ts` imports:

```tsx
// src/app/client/ui-controller.tsx
import { Controller, type OnStart } from "@flamework/core";
import React, { StrictMode } from "@rbxts/react";
import { createPortal, createRoot } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { App } from "./app";

@Controller()
export class UiController implements OnStart {
	onStart() {
		const root = createRoot(new Instance("Folder"));
		root.render(<StrictMode>{createPortal(<App />, Players.LocalPlayer.WaitForChild("PlayerGui"))}</StrictMode>);
	}
}
```

React reads its dev flags once, when it first loads, so set them in a file that `main.client.ts` imports before anything that loads React: `ReactGlobals.__DEV__ = RunService.IsStudio()`, with `ReactGlobals` from `@rbxts/react-globals`. For React DevTools, see the README. Each component has a story beside it, `<component>.story.tsx`, made with `CreateReactStory` from `@rbxts/ui-labs`. A story renders the component alone, so pass in through props what comes from controllers.

`mise run ui` renders every story offline and prints each picture's path. Open each picture you changed and look at it: text cut off, overlap, alignment, the empty state. A story that renders cleanly can still look wrong.

- To check that a component responds to input, click or type into its story: `mise run ui -- --story <path>.story.tsx --actions '[{"type":"click","node":"buy","t":0.2}]'` prints what the story printed and the picture's path. Actions also take `key`, `text`, `drag` and `wheel`, aimed at a node's name or `x`, `y`. A node is named after its React key (`buy` above), and a failed action lists the names there are.
- To render a story in another state, set its controls: `mise run ui -- --story <path>.story.tsx --controls '{"count":0}'`, rather than editing the story. `mise run ui -- --help` lists every option.
- To see what your change did to a component: `mise run ui -- diff HEAD --story <path>.story.tsx` renders it before and after, and writes `diff.png`. Do this for every change to how a component looks, and show the user both pictures. Add `--viewport 320x240` (any size) to render on a smaller or larger screen.

- Animate with `useMotion` from `@rbxts/pretty-react-hooks`: the motion drives a binding, so nothing re-renders. The same package has hooks for events, timers, debouncing and the previous value.
- A story renders inside a `Frame`, so a component whose root is a `ScreenGui` draws nothing.
- rur needs Roblox Studio's fonts to draw text; outside Windows and WSL, set `RUR_ROBLOX_CONTENT` (see `.env.example`). Without them, as in a cloud session, the pictures have no text: judge layout, size and overlap.
