# my-game

A Roblox game in Luau: Rojo serves it, Rogen places each file in the game, Wally brings the packages, and luau-lsp type-checks it in strict mode against every instance in the game. Services and controllers are plain modules; React draws the UI.

## Look it up, don't recall it

What you remember of Luau's type system, react-lua, Rogen and the Roblox API is likely out of date or wrong. Before you use an API you aren't sure of, read the docs that match the installed versions:

- Roblox API: search `.luau-lsp/globalTypes.d.luau` for the class or member, as luau-lsp types it. For what it does, read its page on create.roblox.com: add `.md` to a page's link for Markdown, and start from https://create.roblox.com/docs/llms.txt rather than guessing a URL.
- Luau itself (types, generics, `--!strict`, string interpolation): https://luau.org, and https://luau.org/typecheck for the type checker.
- React: react-lua follows React 17; how it differs is in `Packages/_Index/jsdotlua_react@*/react/README.md` and https://jsdotlua.github.io/react-lua/. Ripple's hooks: `Packages/_Index/littensy_react-ripple@*/`.
- Any other package: its folder under `Packages/_Index/` (or `ServerPackages/`, `DevPackages/`): the `README.md` when there is one, and the types its source exports.
- Rogen: `rogen doc <topic>` and `rogen help <command> --json`. Other tools: `<tool> --help`, and the skills below for how this game uses them.
- How this game is set up (the check, tests, UI, the world, publishing, its keys): `mise run doc <topic>`, Baseplate's docs for the version this game came from; `mise run doc` lists the topics.

Before you change something, look at what's there: the code that calls it, where it lands (`rogen where <path>`), and for the map its file in `world/`. Where this file and the code disagree, the code is right: follow it, and say so when you report back.

## Checking your work

`mise run check` is the check: it formats (StyLua), type-checks (luau-lsp), lints (Selene), builds the place, runs the tests and renders the UI stories, in about three seconds, and prints only what failed. Run it after each change and fix what it reports until it passes. In Claude Code, Codex, Cursor, GitHub Copilot and Gemini CLI, a hook formats and lints each file you edit and, outside Cursor, hands back the lint problems left; another runs the check when you stop and hands back any failure; in any tool, the commit hook runs it on what you commit. The stop hook and the commit hook skip it when it already passed on exactly those files.

- While iterating, narrower loops are faster: `mise run analyze` for type errors, `mise run test` for the tests (`mise run test -- shop` for the specs and end-to-end tests whose path matches, `-t <name>` for one test by name), `mise run ui -- --filter <name>` for one story's picture.
- When a Selene rule is wrong for one line, allow it on the line above with a comment saying why: `-- selene: allow(global_usage) -- <why>`. Don't silence the type checker with `:: any`; fix the type.
- Every file is `--!strict` (`.luaurc`), and luau-lsp knows every instance in the game, world included: `ReplicatedStorage.Shared.features.shop.ShopNetwork` (once a `shop` feature has one) and `workspace.SpawnLocation` are typed, and a wrong name fails the check.
- The project's tools come from mise: `rogen`, `forge`, `ror`, `ree`, `rojo`, `wally`, `stylua`, `selene`, `luau-lsp`, `lune` and the rest are on the PATH only where your shell activates mise. Elsewhere, run them as `mise x -- rogen where <path>`, and so on for the commands below and in the skills. To change a tool's pin in `mise.toml`, run `mise lock` after it: `mise install` refuses a tool that `mise.lock` doesn't list with its checksums.
- `mise run dev` serves the code to Studio: it is the "serve script" that Rogen's section below refers to.
- Generated files change through their generator, and a hook blocks direct edits: `Packages/`, `ServerPackages/`, `DevPackages/` and `wally.lock` (Wally, from `wally.toml`), `build/` (builds), `default.project.json` (Rogen), `game.project.json`, `test.project.json` and `sourcemap.json` (`mise run generate`, from the code and `world/`), `.luau-lsp/` (Roblox's types for the pinned luau-lsp).

## Where code goes

Code in `src/` sits in four layers, and a module requires only down: `app`, then `features`, then `game`, then `platform`. The check reads every `require` through `sourcemap.json` and fails on anything else.

- `app/`: the entry scripts: `app/server/Main.server.luau` lists every service and starts each, `app/client/Start.luau` (which `Main.client.luau` runs) does the same for controllers. Both lists start with only the services and controllers the add-ons bring, and the game has no UI root yet: see UI to add one. It may require every layer.
- `features/<feature>/`: what the game could ship without: a shop, quests, a season. `mise run feature <name>` creates one. It may require `game`, `platform` and other features, but the features never require each other in a cycle.
- `game/<system>/`: the always-on systems: platform singletons (the one `ProcessReceipt`, the player's saved data), what features build on (currency, teams) and concepts several features write. It never requires a feature or `app`.
- `platform/<module>/`: game-agnostic Roblox code that would move unchanged to another game: network middleware, sound playback, UI primitives. It requires none of the other layers.

A feature or a system? Delete the folder: if the game still works, it's a feature; if other code breaks, it belongs in `game/`. The children of `game/` and `platform/` are folders named for what they hold: no loose files there, and no `util(s)` or `lib(s)`. Folder names are lowercase letters and digits, since they are parts of a require path.

Inside a feature or module, and in `app/`, the folder a file sits in decides where it runs, and its path in the game: `ServerScriptService.<layer>.<name>`:

- `server/`: only on the server, never sent to clients: `ServerScriptService.features.<feature>`. Rules, validation and secrets go here.
- `client/`: only on the player's device: `StarterPlayerScripts.features.<feature>`, copied into each player.
- `shared/`: both: `ReplicatedStorage.Shared.features.<feature>`. It can't require `server/` or `client/` code: the server's folders are empty on clients, and the check fails on client-visible code that reaches for `ServerScriptService` or `ServerStorage`.

The check also keeps each side's own APIs on that side (`scripts/sides.ts` lists them): `Players.LocalPlayer`, `UserInputService`, `RunService.RenderStepped` and the like fail in `server/`; `DataStoreService`, `MessagingService`, `ServerStorage`, `HttpService:RequestAsync` and the like fail in `client/`. Both lists apply in `shared/`: if a call there is guarded by `RunService:IsServer()` or `IsClient()`, add `-- guarded: <why>` to its line.

Side folders sit only at `app/<side>/` and `<layer>/<module>/<side>/`, and a file outside one isn't placed in the game: there's no default side, so server code can't reach clients by mistake. Files are PascalCase, named after what they hold: `InventoryService.luau`.

Require by instance path, the way `rogen where <file>` prints it: `require(ReplicatedStorage.Shared.features.shop.ShopNetwork)`, `require(ServerScriptService.game.bank.Bank)`. Client code is copied into each player at runtime, so it reaches other client code from `script`, as the lines `mise run feature` adds to `src/app/client/Start.luau` do: `script.Parent.Parent.features.shop.ShopController`.

Code meets in three ways. Require directly by default: a feature requires the service it needs. When one owner has many contributors, put a registry in `game/`: the one `ProcessReceipt` handler lives there, and each feature registers its product handlers with it, so `game/` never requires a feature. For a fact that others react to, the emitter exports a typed signal that listeners subscribe to. Never a string-keyed event bus.

## Adding a feature

Run `mise run feature <name>` to start one, and read `.agents/skills/add-feature/SKILL.md`: it writes steps 1 and 2 below and the service's spec. By hand:

1. Remotes in `shared/<Feature>Network.luau`, made with [Remo](https://github.com/littensy/remo) (`ReplicatedStorage.Packages.Remo`) in a namespace named after the feature, with a `Remotes` type that gives their arguments (`Remo.ClientToServer<number>`, `Remo.ServerToClient<number>`, `Remo.ServerAsync<(number), (string)>`), as the `<Feature>Network.luau` that `mise run feature` writes does. Each argument a client sends gets a `t` validator (`Remo.remote(t.integer, t.string)`), and each client-to-server remote `.middleware(Remo.throttleMiddleware(<seconds>))`. A request the server answers (`ServerAsync`) declares what it returns: `Remo.remote(t.number).returns(t.string)`; the service connects with `Network.name:onRequest(function(player, id) return "..." end)` (the callback may return a Promise instead), and the client asks with `Network.name:request(id)`, a Promise of the answer, which Remo checks against `.returns`.
2. A service in `server/<Feature>Service.luau` and, if the client takes part, a controller in `client/<Feature>Controller.luau`: a module with a `start()` that connects its remotes and events. Add each to the list in `src/app/server/Main.server.luau` or `src/app/client/Start.luau`, or it never starts; the check fails on one that isn't.
3. UI as a component in `client/` with a story, rendered from the root component (see UI).
4. Tests: a spec for the service, and an end-to-end test for each request a client sends.

The rules the code follows:

- **Never trust the client.** Clients ask; services decide. Check every request on the server: rate limits, ownership, cost, distance, cooldowns. The server takes what clients send only through Remo remotes, whose validators drop calls with the wrong arguments and whose throttle drops floods; the throttle fits the action (a purchase is one a second, not twenty). The check fails on `OnServerEvent` or `OnServerInvoke` in the game's code, and on a remote clients send that has no throttle, or no validators for its arguments; mark one any client may send freely with `-- trusts-client: <why>` on the line above it.
- **Services own server state.** A service keeps its state in its module and only it changes it; other code calls its functions. Depend on another service by requiring it.
- **Controllers run the client side.** A controller handles input and the server's events and keeps what the UI shows; the UI reads it from there.

## Tests

`mise run test` runs them offline in ree, an emulated Roblox engine, in a few seconds. Pick the kind by what you test:

- A service's rules and decisions: a spec, `<Name>.spec.luau` beside the code, with Jest from `ReplicatedStorage.DevPackages.JestGlobals`. Pass time in as a parameter (`now: number?`) so the spec doesn't wait. A spec elsewhere, or named `*.test.luau`, would never run, so the check fails on it.
- A client's request through the real server and remotes: an end-to-end test, `tests/e2e/<feature>.luau`.
- Characters, physics, collisions or real DataStore limits, which ree doesn't emulate: an engine spec, `<Name>.engine.spec.luau`, run in real Roblox by `mise run test:engine`.

A failing test's trace names the instance and the file: `ServerScriptService.features.shop.ShopService.spec:22 → src/features/shop/server/ShopService.spec.luau:22`. Before writing a test or debugging a failing one, read `.agents/skills/write-tests/SKILL.md`.

## UI

React from `ReplicatedStorage.Packages.React` (react-lua), written with `React.createElement`. Give each component worth looking at a story beside it, `<Component>.story.luau`, made with `CreateReactStory` from `ReplicatedStorage.DevPackages.UILabs`; A story renders the component alone, so pass in through props what comes from controllers.

The game starts without a UI. To add one, write a root component in `src/app/client/App.luau` (a `ScreenGui` holding the screens) and mount it from `Start.start()` in `src/app/client/Start.luau`, after the controllers start:

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

- To check that a component responds to input, click or type into its story: `mise run ui -- --story <path>.story.luau --actions '[{"type":"click","node":"TextButton","t":0.2}]'` prints what the story printed and the picture's path. Actions also take `key`, `text`, `drag` and `wheel`, aimed at a node name or `x`, `y`.
- To see what your change did to a component: `mise run ui -- diff HEAD --story <path>.story.luau` renders it before and after, and writes `diff.png`.

- Animate with `useSpring` or `useMotion` from `ReplicatedStorage.Packages.ReactRipple`: the animation drives a binding, so nothing re-renders.
- A story renders inside a `Frame`, so a component whose root is a `ScreenGui` draws nothing.
- rur needs Roblox Studio's fonts to draw text; outside Windows and WSL, set `RUR_ROBLOX_CONTENT` (see `.env.example`). Without them, as in a cloud session, the pictures have no text: judge layout, size and overlap.

## World and Studio

The map and lighting live in `world/` as files; luau-lsp types them from `sourcemap.json`, so `workspace.SpawnLocation` is a `SpawnLocation` and a part that isn't there fails the check. To change or look at the world, read `.agents/skills/edit-world/SKILL.md`. To run the game in real Studio, for a playtest, characters, physics, its output or a screenshot, read `.agents/skills/drive-studio/SKILL.md`.

## Luau gotchas

luau-lsp and Selene catch most mistakes. These they don't explain:

- Arrays start at 1, `#` counts only up to the first `nil`, and `nil` in a table removes the key. Use `table.insert`, `table.remove` and `table.clear`; iterate with `for i, v in list do`.
- Only `nil` and `false` are falsy: `0` and `""` are true.
- Instances from `FindFirstChild` and `WaitForChild` can be `nil` or of any class to the type checker; check with `if part and part:IsA("BasePart") then`, rather than casting with `::`.
- luau-lsp knows only the instances in the project and `world/`. What appears at runtime, such as a player's `Character` and its `Humanoid`, a `ScreenGui` your code mounts in `PlayerGui`, or a part a script creates, isn't typed: `character.Humanoid` fails the check. Reach it with `WaitForChild` or `FindFirstChildOfClass` and check its class.
- Yielding functions (`task.wait`, `WaitForChild`, `InvokeServer`, DataStore calls) pause the thread: never call them where the order of events matters without saying so, and use `task.spawn` or `task.defer` to run something alongside.

## Packages

The game's Roblox packages come from Wally: add one to `wally.toml` under `[dependencies]` (shared), `[server-dependencies]` (server only, in `ServerScriptService.ServerPackages`) or `[dev-dependencies]` (tests and stories, in `ReplicatedStorage.DevPackages`), pinned exactly (`Name = "scope/name@=1.2.3"`), then run `mise run install`; its types come with it. Find a package and its versions at https://wally.run. The tools written for Node (Rogen, rbx-forge, jest-roblox, Biome) are in `package.json`, added with `pnpm add -D`; pnpm installs only versions published at least two weeks ago.

## Releases and updates

You make a release ready and the user ships it: a hook stops `mise run publish`, Studio's Open Cloud tools and Luau run in Studio that reaches the live game's data. Read `.agents/skills/release/SKILL.md` to prepare one. After the user has published to dev, `mise run errors -- <version>` reads the new errors, with stack traces, with a read-only key. For a Renovate update, a `*.baseplate-new` file or a failing `agent-files` check, read `.agents/skills/upgrade/SKILL.md`.

## Writing for people

Comments, commit messages and pull requests are read by someone who never saw this conversation. Say what the code does and why, not how you got there. When you report back, say how you checked the work: the check passed, which pictures you looked at, what you played in Studio.

<!-- rogen -->
## Rogen

This repo uses Rogen: each `*.rogen.json` generates the `*.project.json` beside it from folder and file names.

- A file's path on disk is not its path in the game. Run `rogen where <path>` to see where it lands and how to require it.
- The outermost route wins, so `shared/server/Save.luau` ships to clients. Keep server-only code under a server route.
- After you add, move or delete files, run `rogen check <paths>` and fix what it prints.
- Edit the `*.rogen.json`, never the `*.project.json`. Packages go in its `tree`, and a change to `routes` goes in every `*.rogen.json` it concerns.
- To sync to Studio, use the repo's serve script, or run `rogen serve --json` in the background.
- For anything else, run `rogen doc <topic>` or `rogen help <command> --json`.
<!-- /rogen -->
