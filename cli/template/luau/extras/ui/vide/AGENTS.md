## UI

Vide from `ReplicatedStorage.Packages.Vide`. A component is a function that runs once and returns instances, made with `Vide.create("TextButton")({ ... })`: properties and events by name (`Activated = function() ... end`), children as list entries in the same table. State lives in sources, read by calling them (`clicks()`), and a property given a function updates when the sources it reads change (``Text = function() return `Clicks: {clicks()}` end``). Make state with `Vide.source`, derive values with `Vide.derive`, run code when sources change with `Vide.effect`, and undo what a component set up, such as a subscription, with `Vide.cleanup`. Give each component worth looking at a story beside it, `<Component>.story.luau`, made with `CreateVideStory` from `ReplicatedStorage.DevPackages.UILabs`. A story renders the component alone, so pass in through props what comes from controllers; its controls arrive as sources.

The game starts without a UI. To add one, write a root component in `src/app/client/App.luau` (a function returning a `ScreenGui` with `ResetOnSpawn = false`) and mount it from `Start.start()` in `src/app/client/Start.luau`, after the controllers start:

```lua
-- In Studio, Vide checks for mistakes and gives readable errors; live servers skip that cost.
Vide.strict = RunService:IsStudio()

local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
Vide.mount(App, playerGui)
```

A story is a module that returns `CreateVideStory` with its controls and a function that builds the component:

```lua
return UILabs.CreateVideStory({
	vide = Vide,
	controls = { count = UILabs.Number(0, 0) },
}, function(props)
	return Counter({ count = props.controls.count })
end)
```

`mise run ui` renders every story offline and prints each picture's path. Open each picture you changed and look at it: text cut off, overlap, alignment, the empty state. A story that renders cleanly can still look wrong.

- To check that a component responds to input, click or type into its story: `mise run ui -- --story <path>.story.luau --actions '[{"type":"click","node":"TextButton","t":0.2}]'` prints what the story printed and the picture's path. Actions also take `key`, `text`, `drag` and `wheel`, aimed at a node name or `x`, `y`.
- To see what your change did to a component: `mise run ui -- diff HEAD --story <path>.story.luau` renders it before and after, and writes `diff.png`.

- Animate with `useSpring` or `useMotion` from `ReplicatedStorage.Packages.VideRipple`: the animation drives a source, so only the properties that read it update.
- Vide sets its own defaults on the instances it creates (a white background, no border, black SourceSans text), unlike Roblox's: set the properties you rely on.
- Vide's property tables aren't type-checked: a misspelled property or a wrong type fails only when the component runs, so render its story.
- A story renders inside a `Frame`, so a component whose root is a `ScreenGui` draws nothing.
- rur needs Roblox Studio's fonts to draw text; outside Windows and WSL, set `RUR_ROBLOX_CONTENT` (see `.env.example`). Without them, as in a cloud session, the pictures have no text: judge layout, size and overlap.
- In Studio, Vide runs in strict mode (set where you mount): it runs each effect twice to catch side effects, and reports mistakes with readable errors.
