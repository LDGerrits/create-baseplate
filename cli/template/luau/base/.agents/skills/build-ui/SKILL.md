---
name: build-ui
description: Build, restyle or check the game's UI: components, their stories and pictures, the UI root, small screens, clicks. Use for a HUD, a screen, a menu or a button, or when UI looks wrong.
---

# Build UI

React from `ReplicatedStorage.Packages.React` (react-lua), written with `React.createElement`. Give each component worth looking at a story beside it, `<Component>.story.luau`, made with `CreateReactStory` from `ReplicatedStorage.DevPackages.UILabs`. A story renders the component alone, so pass in through props what comes from controllers.

The game starts without a UI. To add one, write a root component in `src/app/client/App.luau` (a `ScreenGui` holding the screens) and mount it from `Start.start()` in `src/app/client/Start.luau`, after the controllers start:

App.luau reaches a feature's client components the way `Start.luau` reaches its controllers: `require(script.Parent.Parent.features.shop.ShopPanel)`.

```lua
-- At the top of Start.luau: React reads this flag once, when it first loads. In Studio, React checks
-- hooks and keys and gives readable errors; live servers skip that cost.
-- selene: allow(global_usage) -- react-lua reads its dev flag from _G
_G.__DEV__ = RunService:IsStudio()

-- In Start.start(), after the controllers:
local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
local root = ReactRoblox.createRoot(Instance.new("Folder"))
root:render(React.createElement(React.StrictMode, nil, ReactRoblox.createPortal(React.createElement(App), playerGui)))
```

A story is a module that returns `CreateReactStory` with its controls and a function that renders the component:

```lua
return UILabs.CreateReactStory({
	react = React,
	reactRoblox = ReactRoblox,
	controls = { count = UILabs.Number(0, 0) },
}, function(props)
	return React.createElement(Counter, { count = props.controls.count })
end)
```

`mise run ui` renders every story offline and prints each picture's path. Open each picture you changed and look at it: text cut off, overlap, alignment, the empty state. A story that renders cleanly can still look wrong.

- To check that a component responds to input, click or type into its story: `mise run ui -- --story <path>.story.luau --actions '[{"type":"click","node":"buy","t":0.2}]'` prints what the story printed and the picture's path. Actions also take `key`, `text`, `drag` and `wheel`, aimed at a node's name or `x`, `y`. A node is named after its React key (`buy` above), and a failed action lists the names there are.
- To render a story in another state, set its controls: `mise run ui -- --story <path>.story.luau --controls '{"count":0}'`, rather than editing the story. `mise run ui -- --help` lists every option.
- To see what your change did to a component: `mise run ui -- diff HEAD --story <path>.story.luau` renders it before and after, and writes `diff.png`. Do this for every change to how a component looks, and show the user both pictures. Add `--viewport 320x240` (any size) to render on a smaller or larger screen.

- Animate with `useSpring` or `useMotion` from `ReplicatedStorage.Packages.ReactRipple`: the animation drives a binding, so nothing re-renders.
- A story renders inside a `Frame`, so a component whose root is a `ScreenGui` draws nothing.
- rur needs Roblox Studio's fonts to draw text; outside Windows and WSL, set `RUR_ROBLOX_CONTENT` (see `.env.example`). Without them, as in a cloud session, the pictures have no text: judge layout, size and overlap.
