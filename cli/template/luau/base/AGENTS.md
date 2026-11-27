# my-game

A Roblox game in Luau: Rojo serves it, Rogen places each file in the game, Wally brings the packages, and luau-lsp type-checks it in strict mode against every instance in the game. Services and controllers are plain modules; React draws the UI.

## Look it up, don't recall it

What you remember of Luau's type system, react-lua, Rogen and the Roblox API is likely out of date or wrong. Before you use an API you aren't sure of, read the docs that match the installed versions:

- Roblox API: search `.luau-lsp/globalTypes.d.luau` for the class or member, as luau-lsp types it. For what it does, read its page on create.roblox.com: add `.md` to a page's link for Markdown, and start from https://create.roblox.com/docs/llms.txt rather than guessing a URL.
- Luau itself (types, generics, `--!strict`, string interpolation): https://luau.org, and https://luau.org/typecheck for the type checker.
- React: react-lua follows React 17; how it differs is at https://jsdotlua.github.io/react-lua/, and what it exports in `Packages/_Index/jsdotlua_react@*/react/src/init.luau`. Ripple's hooks: `Packages/_Index/littensy_react-ripple@*/`.
- Any other package: its folder under `Packages/_Index/` (or `ServerPackages/`, `DevPackages/`): the `README.md` when there is one, and the types its source exports.
- Rogen: `rogen doc <topic>` and `rogen help <command> --json`. Other tools: `<tool> --help`, and the skills below for how this game uses them.
- How this game is set up (the check, tests, UI, the world, publishing, its keys): `mise run doc <topic>`, Baseplate's docs for the version this game came from; `mise run doc` lists the topics.

Before you change something, look at what's there: the code that calls it, where it lands (`rogen where <path>`), and for the map its file in `world/`. Where this file and the code disagree, the code is right: follow it, and say so when you report back.

## Checking your work

`mise run check` is the check: it formats (StyLua), type-checks (luau-lsp), lints (Selene), builds the place, runs the tests and renders the UI stories, in about three seconds, and prints only what failed. Hooks run it for you: after each file you write, from an edit tool or the shell, they hand you the problems left in that file (not in Cursor, which shows that output to no one), and when you stop, and on each commit, they run the whole check and hand you what failed. In a tool without hooks, run it yourself before you finish.

- For one question, narrower commands answer sooner: `mise run analyze` for type errors, `mise run test -- shop` for the specs and end-to-end tests whose path matches (`-t <name>` for one test by name), `mise run ui -- --filter <name>` for one story's picture.
- The project's tools come from mise: `rogen`, `forge`, `ror`, `ree`, `rojo`, `wally`, `stylua`, `selene`, `luau-lsp`, `lune` and the rest are on the PATH in Claude Code's shell (a hook adds them when the session starts) and wherever your shell activates mise. Elsewhere, run them as `mise x -- rogen where <path>`, and so on for the commands below and in the skills.
- `mise run dev` serves the code to Studio: it is the "serve script" that Rogen's section below refers to.

## Skills

Before the work a skill covers, read it: `.agents/skills/<name>/SKILL.md`.

- `add-feature`: a new mechanic, system or screen (a shop, a quest, a daily reward).
- `write-tests`: a spec, an end-to-end test or an engine spec, or a test that fails.
- `build-ui`: a component, a screen or the UI root; restyling; UI that looks wrong.
- `edit-world`: the map, lighting or placed models in `world/`: looking at them, changing them, syncing Studio's edits back.
- `drive-studio`: playing the game in real Studio: characters, physics, its output, a screenshot.
- `release`: preparing a release or a publish.
- `upgrade`: a Renovate update, a `*.baseplate-new` file, a failing `agent-files` check, a tool or package update.

## Where code goes

Code in `src/` sits in four layers, and a module requires only down: `app`, then `features`, then `game`, then `platform`. The check reads every `require` through `sourcemap.json` and fails on anything else.

- `app/`: the entry scripts: `app/server/Main.server.luau` lists every service and starts each, `app/client/Start.luau` (which `Main.client.luau` runs) does the same for controllers. Both lists start with only the services and controllers the add-ons bring, and the game has no UI root yet: `.agents/skills/build-ui/SKILL.md` shows how to add one. It may require every layer.
- `features/<feature>/`: what the game could ship without: a shop, quests, a season. `mise run feature <name>` creates one. It may require `game`, `platform` and other features, but the features never require each other in a cycle.
- `game/<system>/`: the always-on systems: platform singletons (the one `ProcessReceipt`, the player's saved data), what features build on (currency, teams) and concepts several features write. It never requires a feature or `app`.
- `platform/<module>/`: game-agnostic Roblox code that would move unchanged to another game: network middleware, sound playback, UI primitives. It requires none of the other layers.

A feature or a system? Delete the folder: if the game still works, it's a feature; if other code breaks, it belongs in `game/`.

Inside a feature or module, and in `app/`, the folder a file sits in decides where it runs, and its path in the game: `ServerScriptService.<layer>.<name>`:

- `server/`: only on the server, never sent to clients: `ServerScriptService.features.<feature>`. Rules, validation and secrets go here.
- `client/`: only on the player's device: `StarterPlayerScripts.features.<feature>`, copied into each player.
- `shared/`: both: `ReplicatedStorage.Shared.features.<feature>`. It can't require `server/` or `client/` code: the server's folders are empty on clients, and the check fails on client-visible code that reaches for `ServerScriptService` or `ServerStorage`.

Name each file after what it holds: `InventoryService.luau`.

Require by instance path, the way `rogen where <file>` prints it: `require(ReplicatedStorage.Shared.features.shop.ShopNetwork)`.

Code meets in three ways. Require directly by default: a feature requires the service it needs. When one owner has many contributors, put a registry in `game/`: the one `ProcessReceipt` handler lives there, and each feature registers its product handlers with it, so `game/` never requires a feature. For a fact that others react to, the emitter exports a typed signal that listeners subscribe to. Never a string-keyed event bus.

## Adding a feature

Start one with `mise run feature <name>`, and read `.agents/skills/add-feature/SKILL.md` before you build on it. It writes the feature's remotes, a service with its spec, a controller, an end-to-end test, and the entry scripts' lines that start them. Remotes are [Remo](https://github.com/littensy/remo)'s, as its network module shows; Remo has no README: its API and types are in `Packages/_Index/littensy_remo@*/remo/src/types.luau`.

The rules the code follows:

- **Never trust the client.** Clients ask; services decide. Check every request on the server: rate limits, ownership, cost, distance, cooldowns. The server takes what clients send only through Remo remotes, whose validators drop calls with the wrong arguments and whose throttle drops floods; the throttle fits the action (a purchase is one a second, not twenty).
- **Services own server state.** A service keeps its state in its module and only it changes it; other code calls its functions. Depend on another service by requiring it.
- **Controllers run the client side.** A controller handles input and the server's events and keeps what the UI shows; the UI reads it from there.

## Tests

`mise run test` runs them offline in ree, an emulated Roblox engine, in a few seconds. Pick the kind by what you test:

- A service's rules and decisions: a spec, `<Name>.spec.luau` beside the code, with Jest from `ReplicatedStorage.DevPackages.JestGlobals`. Pass time in as a parameter (`now: number?`) so the spec doesn't wait.
- A client's request through the real server and remotes: an end-to-end test, `tests/e2e/<feature>.luau`.
- Characters, physics, collisions or real DataStore limits, which ree doesn't emulate: an engine spec, `<Name>.engine.spec.luau`, run in real Roblox by `mise run test:engine`.

A failing test's trace names the instance and the file: `ServerScriptService.features.shop.ShopService.spec:22 → src/features/shop/server/ShopService.spec.luau:22`. Before writing a test or debugging a failing one, read `.agents/skills/write-tests/SKILL.md`.

## UI

React from `ReplicatedStorage.Packages.React` (react-lua). Look at each component's picture: `mise run ui` renders its story offline. Before you build, restyle or check UI, read `.agents/skills/build-ui/SKILL.md`: mounting the UI root, writing stories, looking at their pictures on any screen size, clicking into them, and before and after.

## World and Studio

The map and lighting live in `world/` as files; luau-lsp types them from `sourcemap.json`, so `workspace.SpawnLocation` is a `SpawnLocation` and a part that isn't there fails the check. To change or look at the world, read `.agents/skills/edit-world/SKILL.md`. To run the game in real Studio, for a playtest, characters, physics, its output or a screenshot, read `.agents/skills/drive-studio/SKILL.md`.

## Luau gotchas

luau-lsp and Selene catch most mistakes. These they don't explain:

- `#` is unreliable on a table with `nil` holes: setting an array element to `nil` leaves a hole, so remove it with `table.remove`.
- Only `nil` and `false` are falsy: `0` and `""` are true.
- A function passed to `pcall` must return the same types on every path; `pcall` returns `ok`, then those values or the error.

## Player data

This game has no data library yet. To save players' data, suggest ProfileStore (`lm-loleris/profilestore`, in `wally.toml`'s `[server-dependencies]`) to the user rather than calling `DataStoreService` by hand: saving written by hand loses data when a player joins a second server before the first saved, or a write fails, which ProfileStore's session locking and retries prevent. Put the one place that loads and saves each player's data in `game/`, as a system the features build on.

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
