# my-game

A Roblox game in TypeScript: roblox-ts compiled by Sloptor, placed in the game by Rogen, with Flamework for services and controllers and React for the UI. The code runs as Luau, not JavaScript (see roblox-ts is not JavaScript).

## Look it up, don't recall it

What you remember of roblox-ts, Flamework, Rogen and the Roblox API is likely out of date or wrong. Before you use an API you aren't sure of, read the docs that match the installed versions:

- Roblox API: search `node_modules/@rbxts/types/include/generated/None.d.ts` for the class or member. Each has a doc comment and a `create.roblox.com` link; add `.md` to that link for the page as Markdown. Start from https://create.roblox.com/docs/llms.txt rather than guessing a URL.
- roblox-ts's own types (`Promise`, arrays, maps): `node_modules/@rbxts/compiler-types/types/`.
- Flamework: the `.d.ts` files in `node_modules/@flamework/core/out/` and `node_modules/@flamework/networking/out/` (events, functions, middleware).
- React: `node_modules/@rbxts/react/README.md` (how React Lua differs) and `src/index.d.ts`; its hooks in `node_modules/@rbxts/pretty-react-hooks/README.md`.
- Any other package: its `README.md` and `.d.ts` files in `node_modules/<name>/`.
- Rogen: `rogen doc <topic>` and `rogen help <command> --json`. Other tools: `<tool> --help`, and the skills below for how this game uses them.
- How this game is set up (the check, tests, UI, the world, publishing, its keys): `mise run doc <topic>`, Baseplate's docs for the version this game came from; `mise run doc` lists the topics.

Before you change something, look at what's there: the code that calls it, where it lands (`rogen where <path>`), and for the map its file in `world/`. Where this file and the code disagree, the code is right: follow it, and say so when you report back.

## Checking your work

`mise run check` is the check: it formats, compiles, lints (applying the fixes ESLint can make), builds the place, runs the tests and renders the UI stories, in about three seconds, and prints only what failed. Run it after each change and fix what it reports until it passes. In Claude Code, Codex, Cursor, GitHub Copilot and Gemini CLI, a hook formats and lints each file you edit and, outside Cursor, hands back the lint problems left; another runs the check when you stop and hands back any failure; in any tool, the commit hook runs it on what you commit. The stop hook and the commit hook skip it when it already passed on exactly those files.

- While iterating, narrower loops are faster: `mise run compile` for type errors, `mise run test` for the tests (`mise run test -- shop` for the specs and end-to-end tests whose path matches, `-t <name>` for one test by name), `mise run ui -- --filter <name>` for one story's picture.
- When a lint rule is wrong for one line, disable it on that line with a comment saying why.
- The project's tools come from mise: `rogen`, `forge`, `ror`, `ree`, `rojo`, `lune` and the rest are on the PATH in Claude Code's shell (a hook adds them when the session starts) and wherever your shell activates mise. Elsewhere, run them as `mise x -- rogen where <path>`, and so on for the commands below and in the skills. To change a tool's pin in `mise.toml`, run `mise lock` after it: `mise install` refuses a tool that `mise.lock` doesn't list with its checksums.
- `mise run dev` serves the code to Studio: it is the "serve script" that Rogen's section below refers to.
- Generated files change through their generator, and a hook blocks direct edits: `out/` and `include/` (the compiler), `build/` (builds), `default.project.json` (Rogen), `game.project.json`, `test.project.json` and `src/world.d.ts` (`mise run check`, from the code and `world/`).

## Where code goes

Code in `src/` sits in four layers, and imports only go down: `app`, then `features`, then `game`, then `platform`. The check fails on anything else.

- `app/`: the entry scripts (`app/server/main.server.ts` and `app/client/main.client.ts` import every service and controller and start Flamework) and the UI root. It may import every layer.
- `features/<feature>/`: what the game could ship without: a shop, quests, a season. `mise run feature <name>` creates one. It may import `game`, `platform` and other features, but the features never import each other in a cycle.
- `game/<system>/`: the always-on systems: platform singletons (the one `ProcessReceipt`, the player's saved data), what features build on (currency, teams) and concepts several features write. It never imports a feature or `app`.
- `platform/<module>/`: game-agnostic Roblox code that would move unchanged to another game: network middleware, sound playback, UI primitives. It imports none of the other layers.

A feature or a system? Delete the folder: if the game still works, it's a feature; if other code breaks, it belongs in `game/`. The children of `game/` and `platform/` are folders named for what they hold: no loose files there, and no `util(s)` or `lib(s)`.

Inside a feature or module, and in `app/`, the folder a file sits in decides where it runs:

- `server/`: only on the server, never sent to clients. Rules, validation and secrets go here.
- `client/`: only on the player's device.
- `shared/`: both. It can't import `server/` or `client/` code; ESLint enforces the sides.

ESLint also keeps each side's own APIs on that side (`scripts/sides.ts` lists them): `Players.LocalPlayer`, `UserInputService`, `RunService.RenderStepped` and the like fail in `server/`; `DataStoreService`, `MessagingService`, `ServerStorage`, `HttpService:RequestAsync` and the like fail in `client/`. Both lists apply in `shared/`: if a call there is guarded by `RunService.IsServer()` or `IsClient()`, disable the rule on that line and say so.

Side folders sit only at `app/<side>/` and `<layer>/<module>/<side>/`, and a file outside one isn't placed in the game: there's no default side, so server code can't reach clients by mistake. Files are kebab-case, named after what they hold: `inventory-service.ts`.

Code meets in three ways. Import directly by default: a feature imports the service it needs. When one owner has many contributors, put a registry in `game/`: the one `ProcessReceipt` handler lives there, and each feature registers its product handlers with it, so `game/` never imports a feature. For a fact that others react to, the emitter exports a typed signal that listeners subscribe to. Never a string-keyed event bus.

## Adding a feature

Run `mise run feature <name>` to start one, and read `.agents/skills/add-feature/SKILL.md`: it writes steps 1 and 2 below and the service's spec. By hand:

1. Network events in `shared/<feature>-network.ts`, with `Networking.createEvent<ClientToServer, ServerToClient>()`.
2. A service in `server/` and, if the client takes part, a controller in `client/`. Import each in `src/app/server/main.server.ts` or `src/app/client/main.client.ts`, or Flamework never starts it; the check fails on one that isn't.
3. UI as a component in `client/` with a story, rendered from the root component (see `.agents/skills/build-ui/SKILL.md`).
4. Tests: a spec for the service, and an end-to-end test for each request a client sends.

The rules the code follows:

- **Never trust the client.** Clients ask; services decide. Check every request on the server: rate limits, ownership, cost, distance, cooldowns. Flamework checks the types of remote arguments, not whether the request is allowed. The check fails on a client-to-server event or function that `createServer` takes without middleware: give it Flamework middleware that rate-limits it, or mark its handler `// trusts-client: <why>`.
- **Services own server state.** Only a service changes its state; other code calls its methods. Depend on another service through the constructor: `constructor(private readonly data: PlayerDataService) {}`.
- **Controllers run the client side.** A controller handles input and the server's events and keeps what the UI shows; the root component subscribes to it.

## Tests

`mise run test` runs them offline in ree, an emulated Roblox engine, in a few seconds. Pick the kind by what you test:

- A service's rules and decisions: a spec, `<name>.spec.ts` beside the code. Pass time in as a parameter (`now`, see `.agents/skills/write-tests/SKILL.md` for which clock) so the spec doesn't wait. A spec elsewhere, or named `*.test.ts`, would never run, so the check fails on it.
- A client's request through the real server and remotes: an end-to-end test, `tests/e2e/<feature>.luau`.
- Characters, physics, collisions or real DataStore limits, which ree doesn't emulate: an engine spec, `<name>.engine.spec.ts`, run in real Roblox by `mise run test:engine`.

Before writing a test or debugging a failing one, read `.agents/skills/write-tests/SKILL.md`.

## UI

React from `@rbxts/react`. Give each component worth looking at a story beside it, `<component>.story.tsx`, and look at its picture: `mise run ui` renders every story offline. Before you build, restyle or check UI, read `.agents/skills/build-ui/SKILL.md`: mounting the UI root, writing stories, looking at their pictures on any screen size, clicking into them, and before and after.

## World and Studio

The map and lighting live in `world/` as files; code reaches them through the types in `src/world.d.ts`, such as `Workspace.SpawnLocation`. To change or look at the world, read `.agents/skills/edit-world/SKILL.md`. To run the game in real Studio, for a playtest, characters, physics, its output or a screenshot, read `.agents/skills/drive-studio/SKILL.md`.

## roblox-ts is not JavaScript

The compiler and ESLint catch most differences (`null`, `.length`, truthiness, `for...in`). These they don't explain:

- There's no Node, DOM or npm runtime. Use Roblox's APIs: `HttpService:JSONEncode` for `JSON`, `task.delay` for `setTimeout`, `print` for `console`, `string.match` for regex. For `Object.keys`, `values`, `entries`, `assign` and `deepCopy`, import `Object` from `@rbxts/object-utils`.
- Packages come from the `@rbxts` scope; a plain npm package won't run in Roblox.
- To stub an interface's method in a spec, write a method (`{ getBalance() { return 0; } }`), not an arrow function in a property: roblox-ts compiles the two differently and refuses the arrow (`expectedMethodGotFunction`).
- Check Roblox values with `typeIs(value, "Vector3")` and `classIs(instance, "Part")`. To check an instance and its children, let Flamework build the check from a type: `Flamework.createGuard<Model & { Humanoid: Humanoid }>()`.

## Luau in a TypeScript game

A hand-written `.luau` module in `src/` is copied to `out/` as it is, and TypeScript imports it through a `.d.ts` beside it. The check formats it with StyLua, lints it with Selene and type-checks it with luau-lsp, strict. Give each Luau module a `.d.ts` beside it that declares what it returns, and a spec that calls it through those types.

## Player data

This game has no data library yet. To save players' data, suggest ProfileStore (`@rbxts/profile-store`) to the user rather than calling `DataStoreService` by hand: saving written by hand loses data when a player joins a second server before the first saved, or a write fails, which ProfileStore's session locking and retries prevent. Put the one place that loads and saves each player's data in `game/`, as a system the features build on.

## Packages

Add one with `pnpm add <name>` (`-D` for build tools). pnpm installs only versions published at least two weeks ago; when it refuses one, pick an older version. If the package's scope is new, such as `@rbxts-js`, mount it under `ReplicatedStorage.rbxts_include.node_modules` in `default.rogen.json`, like the existing scopes. Keep `@rbxts/ripple` on 0.9: `@rbxts/pretty-react-hooks` is built for it, and the game loads one copy.

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
