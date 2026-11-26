# my-game

A Roblox game in Luau, set up for coding agents: one command checks everything, tests and UI run without Studio, and the world lives in files. Works with Claude Code, Codex, Cursor, GitHub Copilot and Gemini CLI.

## What it gives an agent

- **One command checks everything.** `mise run check` formats, type-checks, lints, builds the place, checks that client code never reaches for the server's, runs the tests and renders the UI stories, in about three seconds.
- **Strict types for the whole game.** Every file is `--!strict`, and [luau-lsp](https://github.com/JohnnyMorganz/luau-lsp) type-checks it against every instance in the game, world included, and the packages' own types: `require(ReplicatedStorage.Shared.features.shop.ShopNetwork)` and `workspace.SpawnLocation` are typed, and a wrong name fails the check.
- **Tests run without Studio.** Jest specs and end-to-end tests, with the real server and a client talking through remotes, run in [ree](https://github.com/Anime-Vanguards/roblox-engine-emulator), an emulated Roblox engine, in a few seconds; a failure points at the file and line. The same specs run in real Studio or Open Cloud through [jest-roblox](https://github.com/christopher-buss/jest-roblox-cli) (`mise run test:engine`).
- **It can see the UI.** `mise run ui` renders every story offline with [rur](https://github.com/Anime-Vanguards/roblox-ui-renderer) and prints where each picture is.
- **Remotes can't be taken unguarded.** Remotes are made with [Remo](https://github.com/littensy/remo): each declares its arguments' types and a [`t`](https://github.com/osyrisrblx/t) validator, and client-to-server remotes are throttled per player. The check fails on `OnServerEvent` in the game's own code, and on a remote clients send that has no throttle or no validators.
- **The world is files, apart from the code.** Studio edits the map and [rbx-forge](https://github.com/christopher-buss/rbx-forge) syncs it back into `world/` as readable JSON, while Rojo serves only code.
- **Each feature is one folder.** [Rogen](https://github.com/LDGerrits/rogen) routes its `server/`, `client/` and `shared/` folders to the right place in the game.
- **Instructions where agents look.** `AGENTS.md` covers the layout, adding a feature and the rules; `.agents/skills/` (linked as `.claude/skills/`) covers tests, the world and Studio.
- **Hooks hold the rules, in Claude Code, Codex, Cursor, GitHub Copilot and Gemini CLI.** Before the agent ends its turn, a stop hook runs `mise run check` and hands back any failure; it skips the check when nothing changed since the last pass. After each edit, a hook formats the file (StyLua, or Biome for JSON) and hands Selene's lint problems to the agent right away (in Claude Code, Codex, Copilot and Gemini CLI; in Cursor it only formats). A guard blocks what agents get wrong here, and says what to do instead: editing generated files and installed packages, skipping the commit hook, other toolchain managers, printing `.env`, publishing, and Studio's `open_cloud_invoke` and `execute_luau` that reaches the live game's data. Each tool's config (`.claude/settings.json`, `.codex/hooks.json`, `.cursor/hooks.json`, `.github/hooks/checks.json`, `.gemini/settings.json`) runs the same scripts in `.agents/hooks/`, and a hook that can't find mise lets the agent carry on, except the guard, which still blocks publishing and Studio's live tools. Codex runs project hooks once you trust them with `/hooks`, Gemini CLI once you trust the folder.
- **Type errors as it edits.** In Claude Code, the project's own luau-lsp reports errors after every edit and answers go-to-definition and hover.
- **Every commit is checked.** A git hook runs `mise run ci` on exactly what is being committed, whichever agent or person commits.
- **Ready for parallel and cloud agents.** In a git worktree, the check installs the packages it needs and the keys come from the main checkout's `.env`; each worktree gets its own Studio session. `.agents/hooks/cloud-setup.sh` installs mise, the tools and the packages on a fresh Linux machine: Claude Code's cloud sessions run it as a SessionStart hook, Cursor's cloud agents from `.cursor/environment.json`, and Codespaces from `.devcontainer/devcontainer.json`. For Codex cloud, set the environment's setup script to `bash .agents/hooks/cloud-setup.sh --force`. GitHub Copilot's cloud agent gets the same from `.github/workflows/copilot-setup-steps.yml`. None of them has Roblox Studio, so story pictures there have no text.

## Stack

|           |                                                                                                                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language  | [Luau](https://luau.org), strict, type-checked by [luau-lsp](https://github.com/JohnnyMorganz/luau-lsp)                                                                                                    |
| Sync      | [Rogen](https://github.com/LDGerrits/rogen) over [Rojo](https://rojo.space); [rbx-forge](https://github.com/christopher-buss/rbx-forge) runs Studio and syncback                                           |
| Packages  | [Wally](https://wally.run), typed by [wally-package-types](https://github.com/JohnnyMorganz/wally-package-types)                                                                                            |
| Structure | Services and controllers as plain modules; remotes declared once with [Remo](https://github.com/littensy/remo), checked with [`t`](https://github.com/osyrisrblx/t) and throttled                                                                    |
| UI        | [React](https://github.com/jsdotlua/react-lua) (react-lua), [Ripple](https://github.com/littensy/ripple) for animation, stories in [UI Labs](https://github.com/PepeElToro41/ui-labs) format              |
| Checks    | [StyLua](https://github.com/JohnnyMorganz/StyLua) for formatting, [Selene](https://github.com/Kampfkarren/selene) for lint, luau-lsp for types; Lune for place checks; Biome for JSON and the tooling scripts |
| Tests     | [Jest](https://github.com/jsdotlua/jest-lua) run in [ree](https://github.com/Anime-Vanguards/roblox-engine-emulator), and in Studio or Open Cloud through [jest-roblox](https://github.com/christopher-buss/jest-roblox-cli) |
| Tools     | [mise](https://mise.jdx.dev) pins every tool; pnpm installs the tools written for Node (Rogen, rbx-forge, jest-roblox)                                                                                     |

## Getting started

Install [mise](https://mise.jdx.dev/getting-started.html), then:

```sh
mise install       # Node, pnpm, Rojo, Wally, StyLua, Selene, luau-lsp, Lune, ree, rur, ror
mise run install   # packages, generated files and types, the commit hook, Claude Code's language server
mise run check     # everything should pass
mise run dev       # open Studio on the world, serve the code
mise run sync      # write Studio's world edits into world/
```

Keys and local paths go in `.env`: copy `.env.example`, which lists each one.

## Working on it yourself

- **Editor:** open the folder in VS Code and install the recommended extensions. The mise extension gives VS Code the pinned tools; luau-lsp reads `.vscode/settings.json` (the check reads it too) and types the game from `sourcemap.json`; StyLua formats on save and Selene underlines lint problems.
- **Other editors:** `.editorconfig` sets tabs and line endings, and any editor with luau-lsp works: give it `.vscode/settings.json` as its settings. Run `mise run check` to format.
- **The commit hook** formats the staged files and runs `mise run ci` on exactly what you commit: lint-staged sets unstaged changes and untracked files aside first, so `git add -p` works. It takes a few seconds, and none when the check just passed on exactly what you commit, or when only Markdown is staged. To commit work in progress anyway, `git commit --no-verify`.
- **Tooling in TypeScript:** scripts, hooks and configs are `.ts`, which Node runs directly; `tsconfig.node.json` type-checks them in `mise run check`.
- **Snippets:** in VS Code, type `service` or `controller` in a new file for a skeleton named after the file.
- **Tasks:** `mise tasks` lists every task with what it does.

## CI

`.github/workflows/ci.yml` runs `mise run ci` on Linux for every push and pull request: formatting, types, lint, the place check, and the tests in ree. A second job runs every spec in real Roblox through Open Cloud, on pushes to main and when you run CI by hand but not on pull requests, once you add the repository secret `ROBLOX_OPEN_CLOUD_API_KEY` and the variables `ROBLOX_UNIVERSE_ID` and `ROBLOX_PLACE_ID` (Settings > Secrets and variables > Actions); with the variables but no key it fails. Use an experience made only for tests, never the live game's: each run uploads to its place, and the key can write every place of the experience it's made for. The key needs the `universe-places:write` and `universe.place.luau-execution-session:write` scopes on that experience; [jest-roblox's README](https://github.com/christopher-buss/jest-roblox-cli) has the details.

`.github/workflows/publish.yml` publishes the game through Open Cloud from git, never from a place edited by hand: main to a dev place each time CI passes on it, a version tag (`v1.2.0`) to the live game once someone approves it, after an optional stable place for testers. Each target is a GitHub environment (`dev`, `stable`, `prod`) holding the secret `ROBLOX_PUBLISH_API_KEY`, a key with `universe-places:write` on that target's experience (`prod`'s also needs `universe-datastores.control:snapshot`, because the workflow snapshots the DataStores before it publishes), and its places are the variables `ROBLOX_<TARGET>_UNIVERSE_ID` and `ROBLOX_<TARGET>_PLACE_ID`; a target without them is skipped. Give `prod` required reviewers, or every tag goes live. `mise run publish` publishes the same way from your machine, with the keys in `.env`, but takes no snapshot.

`.github/renovate.json` keeps packages and tools up to date: the Wally packages in `wally.toml` too, read from Wally's registry. A tool's pin also needs its checksums in `mise.lock`, which `.github/workflows/renovate-fixups.yml` adds on Renovate's branches, and a Wally update needs `wally.lock`, which the same workflow writes. The agent files (`AGENTS.md`, the skills, the hooks and the agent tools' settings) follow the create-baseplate version in `package.json`'s `baseplate.version`: when Renovate moves it, the same workflow runs `create-baseplate sync`, which brings them up to that version's template and keeps your own edits, merging them as git would (`.baseplate/agent-files.json` records what the template last wrote). Where your edit and the template's change touch the same lines, it leaves the template's version beside yours as `<file>.baseplate-new`, and the check fails until you merge it and delete that file. If you move the pin yourself, `mise run install` runs the sync. For CI to run again on that commit, create a GitHub App with Contents read and write, install it on the repository, and add its client ID and private key as the secrets `BOT_APP_CLIENT_ID` and `BOT_APP_PRIVATE_KEY`.

## Layout

```
src/
  app/                 entry scripts: start the services and controllers
  features/            one folder per feature, started with `mise run feature <name>`
  game/                the always-on systems features build on, one folder each
  platform/            game-agnostic code that would move unchanged to another game
tests/e2e/             end-to-end tests
world/                 the map and lighting, edited in Studio and synced back
wally.toml             the Roblox packages
```
