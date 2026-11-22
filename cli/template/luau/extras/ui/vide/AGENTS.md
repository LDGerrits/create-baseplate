## UI

Vide from `ReplicatedStorage.Packages.Vide`. A component is a function that runs once and returns instances, made with `Vide.create("TextButton")({ ... })`: properties and events by name (`Activated = function() ... end`), children as list entries in the same table. State lives in sources, read by calling them (`clicks()`), and a property given a function updates when the sources it reads change (``Text = function() return `Clicks: {clicks()}` end``). Make state with `Vide.source`, derive values with `Vide.derive`, run code when sources change with `Vide.effect`, and undo what a component set up, such as a subscription, with `Vide.cleanup`. Give each component worth looking at a story beside it, `<Component>.story.luau`, made with `CreateVideStory` from `ReplicatedStorage.DevPackages.UILabs`; copy `ClickerButton.story.luau`. A story renders the component alone, so pass in through props what comes from controllers; its controls arrive as sources.

`mise run ui` renders every story offline and prints each picture's path. Open each picture you changed and look at it: text cut off, overlap, alignment, the empty state. A story that renders cleanly can still look wrong.

- To check that a component responds to input, click or type into its story: `mise run ui -- --story <path>.story.luau --actions '[{"type":"click","node":"TextButton","t":0.2}]'` prints what the story printed and the picture's path. Actions also take `key`, `text`, `drag` and `wheel`, aimed at a node name or `x`, `y`.
- To see what your change did to a component: `mise run ui -- diff HEAD --story <path>.story.luau` renders it before and after, and writes `diff.png`.

- Animate with `useSpring` or `useMotion` from `ReplicatedStorage.Packages.VideRipple`, as `ClickerButton.luau` does: the animation drives a source, so only the properties that read it update.
- Vide sets its own defaults on the instances it creates (a white background, no border, black SourceSans text), unlike Roblox's: set the properties you rely on.
- Vide's property tables aren't type-checked: a misspelled property or a wrong type fails only when the component runs, so render its story.
- A story renders inside a `Frame`, so a component whose root is a `ScreenGui` draws nothing.
- rur needs Roblox Studio's fonts to draw text; outside Windows and WSL, set `RUR_ROBLOX_CONTENT` (see `.env.example`). Without them, as in a cloud session, the pictures have no text: judge layout, size and overlap.
- In Studio, Vide runs in strict mode (`Start.luau`): it runs each effect twice to catch side effects, and reports mistakes with readable errors.
