## UI

Vide from `@rbxts/vide`. Components are functions that run once and return instances. State lives in sources, read by calling them (`clicks()`), and a prop given a function updates when the sources it reads change (`Text={() => \`Clicks: ${clicks()}\`}`). Make state with `source`, derive values with `derive`, run code when sources change with `effect`, and dispose of subscriptions with `cleanup`. Give each component worth looking at a story beside it, `<component>.story.tsx`, made with `CreateVideStory` from `@rbxts/ui-labs`; copy `clicker-button.story.tsx`. A story renders the component alone, so pass in through props what comes from controllers.

`mise run ui` renders every story offline and prints each picture's path. Open each picture you changed and look at it: text cut off, overlap, alignment, the empty state. A story that renders cleanly can still look wrong.

- To check that a component responds to input, click or type into its story: `mise run ui -- --story <path>.story.tsx --actions '[{"type":"click","node":"TextButton","t":0.2}]'` prints what the story printed and the picture's path.
- To see what your change did to a component: `mise run ui -- diff HEAD --story <path>.story.tsx` renders it before and after, and writes `diff.png`.
- Animate with Vide's `spring`, as `clicker-button.tsx` does.
- Vide sets its own defaults on the instances it creates (such as a white background), unlike Roblox's: set the properties you rely on.
- A story renders inside a `Frame`, so a component whose root is a `ScreenGui` draws nothing.
- rur needs Roblox Studio's fonts to draw text; outside Windows and WSL, set `RUR_ROBLOX_CONTENT` (see `.env.example`).
- In Studio, Vide runs in strict mode (`main.client.tsx`), which reports mistakes with readable errors.
