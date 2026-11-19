# agent-baseplate

A Roblox game written in TypeScript with roblox-ts, compiled by Sloptor, synced to Studio by Rogen and Rojo. Server and client logic runs on Flamework, client state in Charm atoms, and UI in React.

## Checking your work

Run `mise run check` after every change, and fix what it reports until it passes. It formats with Biome, writes the Rojo project file, compiles and type-checks, runs `rogen check`, lints with ESLint, builds the place, checks that every import in the built place resolves, and runs the tests. It takes a few seconds.

- A clean compile doesn't mean the game runs; the tests do run it. Add tests with every feature, as below.
- Don't silence a lint rule to pass the check. If a rule is wrong for a line, disable it on that line with a comment that says why.
- Never edit `out/`, `include/`, `build/`, `node_modules/` or `default.project.json`; they're generated.

## Layout

Code lives in `src`, in four layers. A layer imports only the layers below it, and ESLint enforces it.

- `src/platform/<area>/`: Roblox's outside world, behind interfaces: time, data stores, purchases, teleports, messaging. It knows nothing about the game (see Platform).
- `src/core/<area>/`: what several features share, such as player data. Nothing in core imports a feature.
- `src/features/<feature>/`: one folder per feature, holding everything it needs. A feature never imports another feature. When two features need the same thing, move it into `core`; when one feature must react to another, connect them in `app`.
- `src/app/`: the entry scripts. `app/server/main.server.ts` and `app/client/main.client.tsx` import every service and controller, then start Flamework. `app/client/app.tsx` is the root of the UI.

Inside a platform area, core area or feature, files sit in a folder named for where they run:

- `server/` runs only on the server and never reaches clients. Put rules, validation and secrets here.
- `client/` runs only on the player's device.
- `shared/` ships to both. It can't import `server/` or `client/` code.

Name files in kebab-case, after what they hold: `inventory-service.ts`, `inventory-rules.ts`. `src/features/clicker` is a complete example of every part below; copy its shape.

## Adding a feature

1. Create `src/features/<feature>/` with the `server`, `client` and `shared` folders it needs.
2. Put pure logic (rules, formulas, validation) in `shared/<feature>-rules.ts` as plain functions over plain data, with no Roblox services, so it stays easy to test.
3. Define the feature's network events in `shared/<feature>-network.ts` with `Networking.createEvent<ClientToServer, ServerToClient>()`.
4. Add a service in `server/` and a controller in `client/`, then import each in the matching `src/app/*/main` file.
5. Add UI as views in `client/`, each with a story, and a `client/use-<feature>.ts` hook that connects them; render the top view from `src/app/client/app.tsx` (see UI).
6. Add specs for the rules and the service, and an end-to-end test for each request a client sends (see Testing).
7. Run `mise run check`.

## Testing

`mise run test` compiles and runs the tests offline in ree, an emulator of the Roblox engine, in about a second. `mise run test:engine` runs every Jest spec in a real Roblox engine through jest-roblox, in about twenty seconds. When the two disagree, the real engine is right.

- **Specs** are Jest tests in `<name>.spec.ts` beside the code they test, written with `@rbxts/jest-globals`. Test rules and services through their public methods: construct the service yourself with `new`, passing a fake for each platform interface. `clicker-rules.spec.ts` and `clicker-service.spec.ts` are the examples.
- **Engine specs** are named `<name>.engine.spec.ts`. Use one when the test needs what ree doesn't emulate: collisions and physics beyond free fall, Humanoids (health, `Died`, movement), and real DataStore limits. ree skips them and `test:engine` runs them; run it yourself after changing one.
- **End-to-end tests** are ree harnesses in `tests/e2e/<feature>.luau`: the real server boots, and a player's client talks to it through its remotes, in one run. Copy `tests/e2e/clicker.luau`. A test passes when its client prints `@done`; a failed `assert` fails it.
- ree returns nil from a method it doesn't emulate instead of raising, so a test can pass for the wrong reason. When a result depends on engine behaviour, prove it in an engine spec.
- jest-roblox picks Roblox Studio when it finds it and Open Cloud otherwise; its README (`node_modules/@isentinel/jest-roblox/README.md`) covers both. From WSL it can't find Studio: set `JEST_ROBLOX_STUDIO_PATH` to `RobloxStudioBeta.exe` and `JEST_ROBLOX_PLUGINS_DIR` to the Studio plugins folder, both as `/mnt/c/...` paths.

## UI

UI is React function components from `@rbxts/react`, split in two:

- **Views** are the `.tsx` files in `client/`. A view takes its data and callbacks as props and renders them, like `clicker-button.tsx`. ESLint keeps Flamework, atoms, controllers and hooks out of views.
- **The feature's hook**, `client/use-<feature>.ts`, connects views to the game: it reads atoms with `useAtom`, gets controllers with `Dependency<MyController>()`, and returns the values and callbacks. `src/app/client/app.tsx` calls each hook and passes the result to the top view, like `useClicker` and `ClickerButton`.

Give each view a story beside it, `<view>.story.tsx`, in UI Labs' React format; copy `clicker-button.story.tsx` and add controls for the props worth varying. After changing UI, run `mise run ui`: it renders every story offline with rur and prints the path of each picture. Open the pictures and look at them; a story that renders without errors can still look wrong.

## Platform

Everything outside the game's own state goes through `src/platform`: the time, DataStores, purchases, teleports, cross-server messages, HTTP requests (`HttpService`'s JSON helpers are fine anywhere). A test then swaps in a fake, so a service is tested without waiting, without a real data store, and without a network.

Each platform area holds three things, like `platform/clock`:

- an interface, such as `Clock`, with doc comments saying what each method promises;
- the real implementation, such as `systemClock`, the only code that calls the Roblox API;
- a fake for tests, such as `FakeClock`, which a test controls.

A service asks for the interface in its constructor, `constructor(private readonly clock: Clock) {}`, and each `src/app/*/main` file registers the real one before Flamework starts: `Modding.registerDependency<Clock>(() => systemClock)`. When you add an area, register it there, and add its Roblox service to `platformServices` in `eslint.config.js`, which bans it outside `src/platform`. Wrap only effects that leave the game or depend on time; Instances, datatypes and engine services such as `TweenService` stay as they are.

## How the code works

- **Services own state and rules.** A service (`@Service()`, in `server/`) is the only code that changes its state. Other code calls its methods.
- **Never trust the client.** Clients ask; services decide. Check every request on the server: rate limits, ownership, cost, distance, cooldowns. Flamework checks the types of remote arguments for you, but not whether the request is allowed.
- **Controllers present.** A controller (`@Controller()`, in `client/`) handles input, camera and UI state, and sends requests to the server. It never decides an outcome.
- **Client state lives in Charm atoms** in `client/<feature>-state.ts`. A controller writes them from network events; the feature's hook reads them with `useAtom`.
- **Prefer composition to inheritance.** At most one level of `extends`. Share behaviour through functions and injected services, not base classes.
- Use Flamework's constructor injection to depend on another service in the same feature or in `core`: `constructor(private readonly data: PlayerDataService) {}`.

## roblox-ts is not JavaScript

The code is TypeScript but it runs as Luau. ESLint catches most of these; know them anyway:

- No `null`: use `undefined`. Arrays, maps, sets and strings use `.size()`, never `.length` or `.size`.
- Write explicit conditions: `if (count > 0)`, `if (name !== "")`, `if (item !== undefined)`. In Luau only `nil` and `false` are falsy, so for `if (count)` roblox-ts emits extra checks for `0`, `""` and `NaN`, and the code reads differently from what runs.
- There's no Node, DOM or npm ecosystem: no `JSON`, `setTimeout`, `fetch`, `console`, `Date.now`, regex, or `Object.keys`. Use Roblox APIs: `HttpService:JSONEncode`, `task.delay`, `print`, `os.clock()`, `string.match`, `pairs`.
- Packages come from the `@rbxts` scope, with roblox-ts types. A plain npm package won't run in Roblox.
- Get services from `@rbxts/services`: `import { Players } from "@rbxts/services"`.
- Use the `task` library (`task.wait`, `task.spawn`, `task.delay`), not `wait`, `spawn` or `delay`.
- No getters, setters, `#private` fields, `for...in`, or `typeof x === "..."` checks on Roblox values. Use `typeIs(value, "Vector3")` and `classIs(instance, "Part")`.

## Packages

Add a package with `pnpm add <name>` (or `pnpm add -D` for build tools). If its scope is new, such as `@rbxts-js`, mount the scope under `ReplicatedStorage.rbxts_include.node_modules` in `default.rogen.json`, as the existing scopes are. `mise run check` reports any package the game can't reach.

<!-- rogen -->
## Rogen

This repo uses Rogen. Each `*.rogen.json` generates the Rojo project file beside it (`game.rogen.json` → `game.project.json`) from folder and file names, so a file's path on disk is not its path in the game, and adding, moving or deleting a file can leave the project file out of date.

After you add, move, rename or delete files, or edit a `*.rogen.json`, run `rogen check <paths>` from the repo root. Fix each line it prints, or tell the user why it stays. When it says to run `rogen write`, run it.

### Placing code

- Name new files like their neighbours: same folders, `@` suffixes and casing. Run `rogen where <path>` to see where a file lands and how to require it.
- A folder or `@` suffix named after a key in `routes` routes its contents: `Shop/Server/`, `Save@Server.luau`.
- The outermost route wins, so `Shared/Server/Save.luau` ships to clients. Keep server-only code under a server route.
- In roblox-ts, import by relative path.

### Changing the setup

- Edit the `*.rogen.json`, never the generated `*.project.json`.
- Put what names can't place, such as packages, in the `tree`; Rogen adds the routed files to it.
- Configs share nothing: apply a change to `routes`, `sourcePaths` or `tree` to every `*.rogen.json` it concerns.
- Read `rogen doc routing` before adding a route or a new naming pattern.

### Commands

- In roblox-ts, check `projects/common` through a place that uses it: `rogen check projects/game`.
- Run other commands in the folder of the `*.rogen.json`, or name it: `rogen write projects/game`.
- To sync to Studio, run `rogen serve --json` in the background and leave it running. `rogen help serve` explains its output.
- `rogen doc <topic>` covers `routing`, `config`, `layout` and `output`; `rogen help <command> --json` lists a command's flags and JSON output.
<!-- /rogen -->
