# my-game

A Roblox game in roblox-ts, set up for coding agents: one command checks everything, tests and UI run without Studio, and the world lives in files. Works with Claude Code, Codex, Cursor, GitHub Copilot and Gemini CLI.

## What it gives an agent

- **One command checks everything.** `mise run check` formats, compiles, type-checks, lints, builds the place, verifies every import in it resolves, runs the tests and renders the UI stories, in about ten seconds.
- **Tests run without Studio.** Jest specs and end-to-end tests, with the real server and a client talking through remotes, run in [ree](https://github.com/Anime-Vanguards/roblox-engine-emulator), an emulated Roblox engine, in a few seconds. The same specs run in real Studio or Open Cloud through [jest-roblox](https://github.com/christopher-buss/jest-roblox-cli) (`mise run test:engine`).
- **It can see the UI.** `mise run ui` renders every story offline with [rur](https://github.com/Anime-Vanguards/roblox-ui-renderer) and prints where each picture is.
- **roblox-ts mistakes fail early.** Strict TypeScript, typed networking and ESLint's roblox-ts rules catch the JavaScript habits agents bring (`.length`, `null`, truthiness) and server code imported on the client.
- **The world is files, apart from the code.** Studio edits the map and [rbx-forge](https://github.com/christopher-buss/rbx-forge) syncs it back into `world/` as readable JSON, while Rojo serves only code. The map is typed: `Workspace.SpawnLocation` compiles only if it exists.
- **Each feature is one folder.** [Rogen](https://github.com/LDGerrits/rogen) routes its `server/`, `client/` and `shared/` folders to the right place in the game.
- **Instructions where agents look.** `AGENTS.md` covers the layout, adding a feature and the rules; `.agents/skills/` (linked as `.claude/skills/`) covers tests, the world and Studio.
- **Hooks hold the rules, in Claude Code, Codex, Cursor, GitHub Copilot and Gemini CLI.** Before the agent ends its turn, a stop hook runs `mise run check` and hands back any failure; it skips the check when nothing changed since the last pass. After each edit, a hook formats the file, applies ESLint's safe fixes and hands the lint problems left to the agent right away (in Claude Code, Codex, Copilot and Gemini CLI; in Cursor it only fixes). A guard blocks what agents get wrong here, and says what to do instead: editing generated files, skipping the commit hook, npm or yarn, and printing `.env`. Each tool's config (`.claude/settings.json`, `.codex/hooks.json`, `.cursor/hooks.json`, `.github/hooks/checks.json`, `.gemini/settings.json`) runs the same scripts in `.agents/hooks/`, and a hook that can't find mise lets the agent carry on. Codex runs project hooks once you trust them with `/hooks`, Gemini CLI once you trust the folder.
- **Type errors as it edits.** In Claude Code, the project's own TypeScript language server reports errors after every edit and answers go-to-definition and hover, with the roblox-ts types.
- **Every commit is checked.** A git hook runs `mise run ci` on exactly what is being committed, whichever agent or person commits.
- **Ready for parallel and cloud agents.** `.worktreeinclude` copies `.env` into new worktrees, and `mise run install` gives each clone its own language server. `.agents/hooks/cloud-setup.sh` installs mise, the tools and the packages on a fresh Linux machine: Claude Code's cloud sessions run it as a SessionStart hook, Cursor's cloud agents from `.cursor/environment.json`, and Codespaces from `.devcontainer/devcontainer.json`. For Codex cloud, set the environment's setup script to `bash .agents/hooks/cloud-setup.sh --force`. GitHub Copilot's cloud agent gets the same from `.github/workflows/copilot-setup-steps.yml`. None of them has Roblox Studio, so story pictures there have no text.

## Stack

|           |                                                                                                                                                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Language  | TypeScript with [roblox-ts](https://roblox-ts.com), compiled by [Sloptor](https://github.com/howmanyslop/sloptor)                                                                                                                                                                    |
| Sync      | [Rogen](https://github.com/LDGerrits/rogen) over [Rojo](https://rojo.space); [rbx-forge](https://github.com/christopher-buss/rbx-forge) runs Studio and syncback                                                                                                                     |
| Framework | [Flamework](https://flamework.fireboltofdeath.dev): services, controllers, typed networking                                                                                                                                                                                          |
| UI        | [React](https://github.com/jsdotlua/react-lua) with [pretty-react-hooks](https://github.com/littensy/pretty-react-hooks), [Ripple](https://github.com/littensy/ripple) for animation, stories in [UI Labs](https://github.com/PepeElToro41/ui-labs) format, React DevTools in Studio |
| Checks    | ESLint with typescript-eslint, eslint-plugin-roblox-ts, React's rules (react-hooks, react-x) and eslint-plugin-jest; Biome for formatting; Lune for place checks; the tooling scripts are TypeScript, type-checked too                                                               |
| Tests     | [Jest](https://github.com/jsdotlua/jest-lua) run in [ree](https://github.com/Anime-Vanguards/roblox-engine-emulator), and in Studio or Open Cloud through [jest-roblox](https://github.com/christopher-buss/jest-roblox-cli)                                                         |
| Tools     | [mise](https://mise.jdx.dev) pins every tool; pnpm installs packages                                                                                                                                                                                                                 |

## Getting started

Install [mise](https://mise.jdx.dev/getting-started.html), then:

```sh
mise install       # Node, pnpm, Rojo, Sloptor, Lune, ree, rur, ror
mise run install   # packages, generated files, the commit hook, Claude Code's language server
mise run check     # everything should pass
mise run dev       # compile on save, open Studio on the world, serve the code
mise run sync      # write Studio's world edits into world/
```

Keys and local paths go in `.env`: copy `.env.example`, which lists each one.

## Working on it yourself

- **Editor:** open the folder in VS Code and install the recommended extensions. The mise extension gives VS Code the pinned Node and tools; Biome formats on save and ESLint fixes what it can; the roblox-ts extension shows compile errors as you type.
- **Other editors:** `.editorconfig` sets tabs and line endings, and any TypeScript language server works with `tsconfig.json`. Run `mise run check` to format.
- **The commit hook** formats the staged files and runs `mise run ci` on exactly what you commit: lint-staged sets unstaged changes and untracked files aside first, so `git add -p` works. It takes a few seconds. To commit work in progress anyway, `git commit --no-verify`.
- **React DevTools:** once the UI is mounted as AGENTS.md's UI section shows, run `mise x -- pnpm dlx react-devtools` in your own terminal, set the attribute `ReactDevTools` to true on Workspace in Studio, and play: the app shows the UI's component tree, props and state. React logs one harmless telemetry error when it connects.
- **Tooling in TypeScript:** scripts, hooks and configs are `.ts`. Node runs them directly, ESLint loads its config through jiti, and `tsconfig.node.json` type-checks them in `mise run check`.
- **Snippets:** in VS Code, type `service` or `controller` in a new file for a Flamework skeleton named after the file.
- **Tasks:** `mise tasks` lists every task with what it does.

## CI

`.github/workflows/ci.yml` runs `mise run ci` on Linux for every push and pull request: formatting, compile, lint, the place check, and the tests in ree. A second job runs every spec in real Roblox through Open Cloud once you add the repository secret `ROBLOX_OPEN_CLOUD_API_KEY` and the variables `ROBLOX_UNIVERSE_ID` and `ROBLOX_PLACE_ID` (Settings > Secrets and variables > Actions). Use an experience made only for tests, never the live game's: each run uploads to its place, and the key can write every place of the experience it's made for. The key needs the `universe-places:write` and `universe.place.luau-execution-session:write` scopes on that experience; [jest-roblox's README](https://github.com/christopher-buss/jest-roblox-cli) has the details.

`.github/workflows/publish.yml` publishes the game through Open Cloud from git, never from a place edited by hand: main to a dev place each time CI passes on it, a version tag (`v1.2.0`) to the live game once someone approves it, after an optional stable place for testers. Each target is a GitHub environment (`dev`, `stable`, `prod`) holding the secret `ROBLOX_PUBLISH_API_KEY`, a key with `universe-places:write` on that target's experience, and its places are the variables `ROBLOX_<TARGET>_UNIVERSE_ID` and `ROBLOX_<TARGET>_PLACE_ID`; a target without them is skipped. Give `prod` required reviewers, or every tag goes live. `mise run publish` does the same from your machine, with the keys in `.env`.

`.github/renovate.json` keeps packages and tools up to date. A tool's pin also needs its checksums in `mise.lock`, which `.github/workflows/renovate-fixups.yml` adds on Renovate's branches. The agent files (`AGENTS.md`, the skills, the hooks and the agent tools' settings) follow the create-baseplate version in `package.json`'s `baseplate.version`: when Renovate moves it, the same workflow runs `create-baseplate sync`, which brings them up to that version's template and keeps your own edits, merging them as git would (`.baseplate/agent-files.json` records what the template last wrote). Where your edit and the template's change touch the same lines, it leaves the template's version beside yours as `<file>.baseplate-new`, and the check fails until you merge it and delete that file. If you move the pin yourself, `mise run install` runs the sync. For CI to run again on that commit, create a GitHub App with Contents read and write, install it on the repository, and add its client ID and private key as the secrets `BOT_APP_CLIENT_ID` and `BOT_APP_PRIVATE_KEY`.

## Layout

```
src/
  app/                 entry scripts: start Flamework
  features/            one folder per feature, started by `mise run feature <name>`
tests/e2e/             end-to-end tests
world/                 the map and lighting, edited in Studio and synced back
```
