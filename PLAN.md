# Plan: Baseplate

Turn agent-baseplate into **Baseplate**: a CLI that creates a roblox-ts game set up for coding agents, with a docs site, in the way create-t3-app and create.t3.gg work. Delete this file when the plan is done.

## Decisions

- **Name:** Baseplate. The CLI is `create-baseplate` on npm, run as `pnpm create baseplate` (or `npm create baseplate`). Tagline: "The agent-ready way to start a roblox-ts game." No "Roblox" in names.
- **Site:** Astro with Starlight, deployed on Vercel.
- **Choices:** like create-t3-app, each question offers the most popular libraries plus "none", and "none" keeps the base unopinionated. Which libraries: decided later.
- **Agents first:** every question has a flag, and `--yes` takes the defaults, so an agent can create a project in one command. `--json` prints a machine-readable result.
- **Unpublished** until the user says so: no remote, no npm publish, no Vercel deploy before then.

## Layout (pnpm workspace, as create-t3-app)

```
cli/                 create-baseplate: prompts, flags, copy base, apply extras, install
  template/base/     a complete game that passes `mise run check` on its own
  template/extras/   one folder per add-on choice: files, a manifest, its AGENTS.md section and tests
www/                 the docs site: Astro + Starlight, llms.txt, a Markdown copy of each page
AGENTS.md            how to work on this repo (not the template's AGENTS.md)
```

- `cli/template/base` stays a working project: open it on its own (`cd cli/template/base`) to work on the game template with its own mise tasks, hooks, skills and AGENTS.md. Its commit hook and setup must work from a subfolder of the repo.
- An add-on's manifest says what it adds: dependencies, files, lines in the `main` files, and a section for the generated AGENTS.md. The CLI applies these; nothing about an add-on lives in `base`.

## The CLI

1. Ask (or read flags): project folder and name, then each add-on question, then git init and install.
2. Copy `cli/template/base`, apply each chosen extra, set the project's name (package.json, README, storybook name).
3. `git init`, then `mise install` and `mise run install`, unless `--no-git` / `--no-install`.
4. Print the next steps, or the `--json` result.

Prompts with `@clack/prompts`, as create-t3-app. The template ships inside the npm package, so a CLI version pins a template version.

## CI

- `cli/template/base`: `mise run ci`, as today.
- Generate projects for "none", each add-on alone, and all add-ons together, and run `mise run ci` in each.
- The CLI's own tests, and a build of `www`.

## The docs site

Getting started (people and agents), the agent loop (check, hooks, skills, Studio), the project layout, testing, UI and stories, the world, each add-on, roblox-ts gotchas, and the CLI's flags. `llms.txt` plus a `.md` copy of every page, so agents can read it.

## Phases

1. **Done. Restructure and rename:** move the game into `cli/template/base`, rename to Baseplate, make its hooks and setup work from the subfolder, add the root AGENTS.md and workspace. Done when `cli/template/base` passes `mise run ci` and the root CI runs it.
2. **Done. CLI without add-ons:** create a project from `cli/template/base` with prompts and flags, with tests; CI creates one and checks it.
3. **Docs site:** the pages above, built in CI; deploy to Vercel at publish.
4. **Add-ons.** Done for libraries: state (Charm, Reflex), player data (ProfileStore, Lapis), entities (Flamework Components, Jecs), each or none. Next round, as template variants: the UI framework (React or Vide) and single or multi place.
5. **Publish** (when the user says): GitHub repo, npm package, Vercel site.
