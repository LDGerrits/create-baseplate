# Baseplate

Baseplate creates roblox-ts games set up for coding agents, the way create-t3-app creates web apps. `PLAN.md` holds the plan and its phases.

## Parts

- `template/base/`: the game every project starts from. It is a complete project with its own `AGENTS.md`, mise tasks, hooks and skills, which ship to every game created from it. To work on it, work inside `template/base`: run its commands there and follow its `AGENTS.md`.
- `cli/` (planned): `create-baseplate`, which copies the template and applies the chosen add-ons.
- `www/` (planned): the docs site.

## Checking your work

- In `template/base`: `mise run check`, as its `AGENTS.md` says.
- The commit hook (`.githooks/pre-commit`) runs each part's check on what is being committed. Turn it on in a new clone with `git config core.hooksPath .githooks`.

## Writing

Write the template's files for the game's developers and agents, not for this repo: a generated game has no `template/`, `cli/` or `PLAN.md`. Comments, commit messages and pull requests are read by someone who never saw the conversation.
