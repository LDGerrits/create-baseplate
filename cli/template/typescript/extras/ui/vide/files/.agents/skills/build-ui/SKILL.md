---
name: build-ui
description: Build, restyle or check the game's UI: components, their stories and pictures, the UI root, small screens, clicks. Use for a HUD, a screen, a menu or a button, or when UI looks wrong.
---

# Build UI

Vide from `@rbxts/vide`. Components are functions that run once and return instances. State lives in sources, read by calling them (`clicks()`), and a prop given a function updates when the sources it reads change (`` Text={() => `Clicks: ${clicks()}`} ``). Make state with `source`, derive values with `derive`, run code when sources change with `effect`, and dispose of subscriptions with `cleanup`. Each component has a story beside it, `<component>.story.tsx`, made with `CreateVideStory` from `@rbxts/ui-labs`. A story renders the component alone, so pass in through props what comes from controllers.

The game starts with no UI mounted. To add one, write the root component (`src/app/client/app.tsx`, a `<screengui ResetOnSpawn={false}>` holding your components) and mount it from a controller that `main.client.ts` imports:

```tsx
// src/app/client/ui-controller.tsx
import { Controller, type OnStart } from "@flamework/core";
import { Players, RunService } from "@rbxts/services";
import Vide, { mount } from "@rbxts/vide";
import { App } from "./app";

@Controller()
export class UiController implements OnStart {
	onStart() {
		// In Studio, Vide checks for mistakes and gives readable errors; live servers skip that cost.
		Vide.strict = RunService.IsStudio();
		mount(() => <App />, Players.LocalPlayer.WaitForChild("PlayerGui"));
	}
}
```

`mise run ui` renders every story offline and prints each picture's path. Open each picture you changed and look at it: text cut off, overlap, alignment, the empty state. A story that renders cleanly can still look wrong.

- To check that a component responds to input, click or type into its story: `mise run ui -- --story <path>.story.tsx --actions '[{"type":"click","node":"TextButton","t":0.2}]'` prints what the story printed and the picture's path. A node is named after its `Name`, or its class without one, and a failed action lists the names there are.
- To render a story in another state, set its controls: `mise run ui -- --story <path>.story.tsx --controls '{"count":0}'`, rather than editing the story. `mise run ui -- --help` lists every option.
- To see what your change did to a component: `mise run ui -- diff HEAD --story <path>.story.tsx` renders it before and after, and writes `diff.png`. Do this for every change to how a component looks, and show the user both pictures. Add `--viewport 320x240` (any size) to render on a smaller or larger screen.
- Animate with Vide's `spring`.
- Vide sets its own defaults on the instances it creates (such as a white background), unlike Roblox's: set the properties you rely on.
- A story renders inside a `Frame`, so a component whose root is a `ScreenGui` draws nothing.
- rur needs Roblox Studio's fonts to draw text; outside Windows and WSL, set `RUR_ROBLOX_CONTENT` (see `.env.example`).
