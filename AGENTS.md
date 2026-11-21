# Baseplate

Baseplate creates roblox-ts games set up for coding agents, the way create-t3-app creates web apps. The repo follows create-t3-app's layout. `PLAN.md` holds the plan and its phases.

## Parts

- `cli/`: `create-baseplate`, the CLI (`pnpm create baseplate`). `src/cli/index.ts` reads the flags and asks the questions; `src/helpers/` copy the template, name the project, install and commit; `src/installers/` will hold the add-ons.
- `cli/template/base/`: the game every project starts from. It is a complete project with its own `AGENTS.md`, mise tasks, hooks and skills, which ship to every game created from it. To work on it, work inside `cli/template/base`: run its commands there and follow its `AGENTS.md`.
- `cli/template/extras/`: one folder per add-on choice (none yet).
- `www/` (planned): the docs site.

The build copies the template into `cli/dist/template`, only the files git tracks or would track. npm drops `.gitignore` files and symbolic links from packages, so the copy holds `_gitignore` and `_symlinks.json`, and the CLI restores them.

## Checking your work

- At the root, for the CLI and the docs site: `mise run check` (format, lint, build, type-check, test).
- In `cli/template/base`: its own `mise run check`, as its `AGENTS.md` says.
- To see what a user gets: `pnpm --filter create-baseplate build`, then `node cli/dist/index.js <folder> --json`, and `mise run check` in that folder.
- The commit hook (`.githooks/pre-commit`) runs each part's check when a commit touches it. Turn it on in a new clone with `git config core.hooksPath .githooks`.

## Writing

Write the template's files for the game's developers and agents, not for this repo: a created game has no `cli/` or `PLAN.md`, and its name replaces `my-game`. Comments, commit messages and pull requests are read by someone who never saw the conversation.
