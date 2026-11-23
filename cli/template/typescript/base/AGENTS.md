# my-game

A Roblox game in TypeScript: roblox-ts compiled by Sloptor, placed in the game by Rogen, with Flamework for services and controllers and React for the UI. The code runs as Luau, not JavaScript (see the last section).

## Look it up, don't recall it

What you remember of roblox-ts, Flamework, Rogen and the Roblox API is likely out of date or wrong. Before you use an API you aren't sure of, read the docs that match the installed versions:

- Roblox API: search `node_modules/@rbxts/types/include/generated/None.d.ts` for the class or member. Each has a doc comment and a `create.roblox.com` link; add `.md` to that link for the page as Markdown. Start from https://create.roblox.com/docs/llms.txt rather than guessing a URL.
- roblox-ts's own types (`Promise`, arrays, maps): `node_modules/@rbxts/compiler-types/types/`.
- Flamework: the `.d.ts` files in `node_modules/@flamework/core/out/` and `node_modules/@flamework/networking/out/` (events, functions, middleware).
- React: `node_modules/@rbxts/react/README.md` (how React Lua differs) and `src/index.d.ts`; its hooks in `node_modules/@rbxts/pretty-react-hooks/README.md`.
- Any other package: its `README.md` and `.d.ts` files in `node_modules/<name>/`.
- Rogen: `rogen doc <topic>` and `rogen help <command> --json`. Other tools: `<tool> --help`, and the skills below for how this game uses them.
- How this game is set up (the check, tests, UI, the world, publishing, its keys): `mise run doc <topic>`, Baseplate's docs for the version this game came from; `mise run doc` lists the topics.

## Checking your work

`mise run check` is the check: it formats, compiles, lints, builds the place, runs the tests and renders the UI stories, in about ten seconds. Run it after each change and fix what it reports until it passes. In Claude Code, Codex, Cursor, GitHub Copilot and Gemini CLI, a hook formats and lints each file you edit and, outside Cursor, hands back the lint problems left; another runs the check when you stop and hands back any failure; in any tool, the commit hook runs it on what you commit.

- While iterating, narrower loops are faster: `mise run compile` for type errors, `mise run test` for the tests, `mise run ui --filter <name>` for one story's picture.
- When a lint rule is wrong for one line, disable it on that line with a comment saying why.
- The project's tools come from mise: `rogen`, `forge`, `ror`, `ree`, `rojo`, `lune` and the rest are on the PATH only where your shell activates mise. Elsewhere, run them as `mise x -- rogen where <path>`, and so on for the commands below and in the skills. To change a tool's pin in `mise.toml`, run `mise lock` after it: `mise install` refuses a tool that `mise.lock` doesn't list with its checksums.
- Generated files change through their generator, and a hook blocks direct edits: `out/` and `include/` (the compiler), `build/` (builds), `default.project.json` (Rogen), `game.project.json`, `test.project.json` and `src/world.d.ts` (`mise run check`, from the code and `world/`).

## Where code goes

Each feature is a folder, `src/features/<feature>/`; `src/features/clicker` is the example to copy. Inside it, the folder a file sits in decides where it runs:

- `server/`: only on the server, never sent to clients. Rules, validation and secrets go here.
- `client/`: only on the player's device.
- `shared/`: both. It can't import `server/` or `client/` code; ESLint enforces the sides.

A file outside these three folders isn't placed in the game, and the check fails on it: there's no default side, so server code can't reach clients by mistake.

`src/app/` holds the entry scripts: `app/server/main.server.ts` and `app/client/start.tsx` (which `main.client.tsx` runs) import every service and controller and start Flamework, and `app/client/app.tsx` is the root of the UI. Files are kebab-case, named after what they hold: `inventory-service.ts`.

## Adding a feature

1. Network events in `shared/<feature>-network.ts`, with `Networking.createEvent<ClientToServer, ServerToClient>()`.
2. A service in `server/` and, if the client takes part, a controller in `client/`. Import each in `src/app/server/main.server.ts` or `src/app/client/start.tsx`, or Flamework never starts it; the check fails on one that isn't.
3. UI as a component in `client/` with a story, rendered from `app.tsx`.
4. Tests: a spec for the service, and an end-to-end test for each request a client sends.

The rules the code follows:

- **Never trust the client.** Clients ask; services decide. Check every request on the server: rate limits, ownership, cost, distance, cooldowns. Flamework checks the types of remote arguments, not whether the request is allowed. The check fails on a client-to-server event or function that `createServer` takes without middleware: give it `rateLimit` from `src/network/server/rate-limit.ts`, as the clicker does, or mark its handler `// trusts-client: <why>`.
- **Services own server state.** Only a service changes its state; other code calls its methods. Depend on another service through the constructor: `constructor(private readonly data: PlayerDataService) {}`.
- **Controllers run the client side.** A controller handles input and the server's events and keeps what the UI shows; `app.tsx` subscribes to it, as with `ClickerController`.

## Tests

`mise run test` runs them offline in ree, an emulated Roblox engine, in a few seconds. Pick the kind by what you test:

- A service's rules and decisions: a spec, `<name>.spec.ts` beside the code. Pass time in as a parameter (`now = os.clock()`) so the spec doesn't wait. A spec elsewhere, or named `*.test.ts`, would never run, so the check fails on it.
- A client's request through the real server and remotes: an end-to-end test, `tests/e2e/<feature>.luau`.
- Characters, physics, collisions or real DataStore limits, which ree doesn't emulate: an engine spec, `<name>.engine.spec.ts`, run in real Roblox by `mise run test:engine`.

Before writing a test or debugging a failing one, read `.agents/skills/write-tests/SKILL.md`.

## UI

React from `@rbxts/react`. Give each component worth looking at a story beside it, `<component>.story.tsx`, made with `CreateReactStory` from `@rbxts/ui-labs`; copy `clicker-button.story.tsx`. A story renders the component alone, so pass in through props what comes from controllers.

`mise run ui` renders every story offline and prints each picture's path. Open each picture you changed and look at it: text cut off, overlap, alignment, the empty state. A story that renders cleanly can still look wrong.

- To check that a component responds to input, click or type into its story: `mise run ui -- --story <path>.story.tsx --actions '[{"type":"click","node":"TextButton","t":0.2}]'` prints what the story printed and the picture's path. Actions also take `key`, `text`, `drag` and `wheel`, aimed at a node name or `x`, `y`.
- To see what your change did to a component: `mise run ui -- diff HEAD --story <path>.story.tsx` renders it before and after, and writes `diff.png`.

- Animate with `useMotion` from `@rbxts/pretty-react-hooks`, as `clicker-button.tsx` does: the motion drives a binding, so nothing re-renders. The same package has hooks for events, timers, debouncing and the previous value.
- A story renders inside a `Frame`, so a component whose root is a `ScreenGui` draws nothing.
- rur needs Roblox Studio's fonts to draw text; outside Windows and WSL, set `RUR_ROBLOX_CONTENT` (see `.env.example`). Without them, as in a cloud session, the pictures have no text: judge layout, size and overlap.

## World and Studio

The map and lighting live in `world/` as files; code reaches them through the types in `src/world.d.ts`, such as `Workspace.SpawnLocation`. To change or look at the world, read `.agents/skills/edit-world/SKILL.md`. To run the game in real Studio, for a playtest, characters, physics, its output or a screenshot, read `.agents/skills/drive-studio/SKILL.md`.

## roblox-ts is not JavaScript

The compiler and ESLint catch most differences (`null`, `.length`, truthiness, `for...in`). These they don't explain:

- There's no Node, DOM or npm runtime. Use Roblox's APIs: `HttpService:JSONEncode` for `JSON`, `task.delay` for `setTimeout`, `print` for `console`, `string.match` for regex. For `Object.keys`, `values`, `entries`, `assign` and `deepCopy`, import `Object` from `@rbxts/object-utils`.
- Packages come from the `@rbxts` scope; a plain npm package won't run in Roblox.
- Check Roblox values with `typeIs(value, "Vector3")` and `classIs(instance, "Part")`. To check an instance and its children, let Flamework build the check from a type: `Flamework.createGuard<Model & { Humanoid: Humanoid }>()`.

## Packages

Add one with `pnpm add <name>` (`-D` for build tools). pnpm installs only versions published at least two weeks ago; when it refuses one, pick an older version. If the package's scope is new, such as `@rbxts-js`, mount it under `ReplicatedStorage.rbxts_include.node_modules` in `default.rogen.json`, like the existing scopes. Keep `@rbxts/ripple` on 0.9: `@rbxts/pretty-react-hooks` is built for it, and the game loads one copy.

## Writing for people

Comments, commit messages and pull requests are read by someone who never saw this conversation. Say what the code does and why, not how you got there. When you report back, say how you checked the work: the check passed, which pictures you looked at, what you played in Studio.

<!-- rogen -->
## Rogen

This repo uses Rogen: each `*.rogen.json` generates the `*.project.json` beside it from folder and file names.

- A file's path on disk is not its path in the game. Run `rogen where <path>` to see where it lands and how to require it.
- The outermost route wins, so `Shared/Server/Save.luau` ships to clients. Keep server-only code under a server route.
- After you add, move or delete files, run `rogen check <paths>` and fix what it prints.
- Edit the `*.rogen.json`, never the `*.project.json`. Packages go in its `tree`, and a change to `routes` goes in every `*.rogen.json` it concerns.
- To sync to Studio, use the repo's serve script, or run `rogen serve --json` in the background.
- For anything else, run `rogen doc <topic>` or `rogen help <command> --json`.
<!-- /rogen -->
