# agent-baseplate

A Roblox game written in TypeScript with roblox-ts, compiled by Sloptor, synced to Studio by Rogen and Rojo. Server and client logic runs on Flamework, and UI in React.

## Checking your work

Run `mise run check` after every change, and fix what it reports until it passes. It formats with Biome, writes the Rojo project file, compiles and type-checks, runs `rogen check`, lints with ESLint, builds the place, checks that every import in the built place resolves, and runs the tests. It takes a few seconds.

- A clean compile doesn't mean the game runs; the tests do run it. Add tests with every feature, as below.
- Don't silence a lint rule to pass the check. If a rule is wrong for a line, disable it on that line with a comment that says why.
- Never edit `out/`, `include/`, `build/`, `node_modules/`, `default.project.json`, `game.project.json` or `src/world.d.ts`; they're generated.

## Layout

- `src/features/<feature>/`: one folder per feature, holding its server, client and shared code. `src/features/clicker` is the example; copy its shape.
- `src/app/`: the entry scripts. `app/server/main.server.ts` and `app/client/main.client.tsx` import every service and controller, then start Flamework. `app/client/app.tsx` is the root of the UI.

Inside a feature, files sit in a folder named for where they run, and Rogen sends each to its place in the game:

- `server/` runs only on the server and never reaches clients. Put rules, validation and secrets here.
- `client/` runs only on the player's device.
- `shared/` ships to both. It can't import `server/` or `client/` code; ESLint enforces the sides.

Name files in kebab-case, after what they hold: `inventory-service.ts`.

## Adding a feature

1. Create `src/features/<feature>/` with the `server`, `client` and `shared` folders it needs.
2. Define the feature's network events in `shared/<feature>-network.ts` with `Networking.createEvent<ClientToServer, ServerToClient>()`.
3. Add a service in `server/` and, if the client takes part, a controller in `client/`. Import each in the matching `src/app/*/main` file.
4. Add UI as a component in `client/` with a story, and render it from `src/app/client/app.tsx` (see UI).
5. Add a spec for the service, and an end-to-end test for each request a client sends (see Testing).
6. Run `mise run check`.

## How the code works

- **Never trust the client.** Clients ask; services decide. Check every request on the server: rate limits, ownership, cost, distance, cooldowns. Flamework checks the types of remote arguments for you, but not whether the request is allowed.
- **Services own server state.** A service (`@Service()`, in `server/`) is the only code that changes its state; other code calls its methods. Depend on another service through the constructor: `constructor(private readonly data: PlayerDataService) {}`.
- **Controllers run the client side.** A controller (`@Controller()`, in `client/`) handles input and the server's events, and keeps what the UI shows, as `ClickerController` keeps the count and lets `app.tsx` subscribe to it.

## Testing

`mise run test` runs the tests offline in ree, an emulated Roblox engine, in about a second; `mise run test:engine` runs the specs in a real Roblox engine. Specs (`<name>.spec.ts`) sit beside the code they test, end-to-end tests in `tests/e2e/`, and `<name>.engine.spec.ts` holds what ree doesn't emulate. Before writing a test or debugging a failing one, read `.agents/skills/write-tests/SKILL.md`.

## UI

UI is React from `@rbxts/react`. Give each component worth looking at a story beside it, `<component>.story.tsx`, in UI Labs' React format; copy `clicker-button.story.tsx`. A story renders the component alone, without Flamework or the server, so pass in through props what comes from controllers.

`mise run ui` renders every story offline with rur and prints each picture's path; `--filter <name>` renders only matching stories. Open each picture you changed and look at it: text cut off, overlap, alignment, the empty state. A story that renders without errors can still look wrong.

- rur needs Roblox Studio's fonts, or it draws no text. On Windows it finds them; from WSL the script finds the newest Windows Studio. Elsewhere, set `RUR_ROBLOX_CONTENT` (see `.env.example`).
- A story renders inside a `Frame`, so a component whose root is a `ScreenGui` draws nothing.
- In Studio, React runs in development mode (`src/app/client/react-dev.ts`), with its warnings in the Output.

## World

The map and lighting live in `world/` as files. Studio edits them and syncback writes them back, while Rojo serves only code. Code reaches world instances through the types generated in `src/world.d.ts`: `Workspace.SpawnLocation`. To change the world or look at it, read `.agents/skills/edit-world/SKILL.md`.

## Studio

ree and rur answer most questions without Studio. To run the game in real Studio, for a playtest, characters, physics, its output or a screenshot, read `.agents/skills/drive-studio/SKILL.md`. forge runs the session, including `rogen serve`.

## roblox-ts is not JavaScript

The code is TypeScript but it runs as Luau. The compiler and ESLint catch most differences (`null`, `.length`, truthiness, `for...in`); these they don't explain:

- There's no Node, DOM or npm ecosystem. Use Roblox's APIs instead: `HttpService:JSONEncode` for `JSON`, `task.delay` for `setTimeout`, `print` for `console`, `string.match` for regex, `pairs` for `Object.keys`.
- Packages come from the `@rbxts` scope, with roblox-ts types. A plain npm package won't run in Roblox.
- Check Roblox values with `typeIs(value, "Vector3")` and `classIs(instance, "Part")`.

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
