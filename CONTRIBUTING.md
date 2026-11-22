# Contributing

Thanks for helping. [AGENTS.md](AGENTS.md) explains the repo's parts and how to check your work, for people and agents alike; read it first.

- **Set up:** install [mise](https://mise.jdx.dev/getting-started.html), then `mise install`, `pnpm install` and `git config core.hooksPath .githooks`, which turns on the commit hook.
- **Check:** `mise run check` at the root; in `cli/template/base`, its own `mise run check`. The commit hook runs both as needed; don't skip it.
- **Changesets:** a change to `cli/src` or `cli/template` needs one: `pnpm changeset`, pick the bump, and say what changed for someone creating a game. CI fails without it.
- **Bugs:** open an issue with the `baseplate` block from your game's `package.json`; the template asks for the rest.

## A new add-on

Open an issue before you build one: say which library or tool, which question it answers, and why it's among the most used. Each choice is tested in many combinations and kept up to date, so the list stays short.

A choice is a folder, `cli/template/extras/<question>/<choice>/`, holding:

- `addon.json`: the manifest, below.
- `AGENTS.md`: its section for the game's `AGENTS.md`, starting with a `## ` heading; it goes before the Rogen section.
- `files/`: copied over the game, in place.
- `mise.toml` (a tool only): its pinned tools, added to the game's `[tools]`, and its tasks, added at the end.

A new question, or a choice of an existing one, also goes in `addOns` in `cli/src/installers/index.ts` (its flag, question, choices with label and hint, default and whether it allows `none`), in `www/src/content/docs/cli.md`, `add-ons.md` and `layout.md`, and in both READMEs; a test fails until the docs name it. CI creates games with every choice, alone and with the others, from that list.

### The manifest

| Field | Required | What |
| --- | --- | --- |
| `dependencies` | yes | Packages to add to `dependencies`, pinned to exact versions: `{ "@rbxts/charm": "0.11.1" }`. `{}` for none. |
| `imports` | yes | Side-effect imports to add after a main file's last import, so Flamework starts what they define: `{ "src/app/server/main.server.ts": ["../../features/spinner/server/spinner-service"] }`. `{}` for none. |
| `removeDependencies` | no | Packages the choice replaces, removed from `dependencies` or `devDependencies`. |
| `removeFiles` | no | Base files the choice replaces, deleted before `files/` is copied. |
| `replaceAgentsSection` | no | The heading of the game's `AGENTS.md` section that this choice's `AGENTS.md` replaces (`"UI"`), instead of adding a section. |
| `replaceText` | no | Exact edits to the game's files: `[{ "file": "mise.toml", "from": "…", "to": "…" }]`. The CLI fails if `from` isn't there, so a template change can't silently skip an edit. |
| `byUi` | no | What changes with the UI choice: `{ "vide": { "dependencies": {…}, "files": "files-vide", "agents": "AGENTS.vide.md" } }` uses those dependencies, that folder in place of `files/`, and that file in place of `AGENTS.md` when the game uses Vide. |
| `conflicts` | no | Choices of other questions this one can't go with, and why: `{ "ui": { "vide": "Reflex has no Vide binding: with --ui vide, choose --state charm or none." } }`. The CLI refuses the pair with that message, the prompts hide it, and CI leaves it out. |

Pin packages in `addon.json` and tools in the add-on's `mise.toml`, where Renovate finds them. A tool that must skip the two-week wait goes in both `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` and Renovate's rule.

Develop the add-on in a game created by the CLI (`pnpm --filter create-baseplate build`, then `node cli/dist/index.js <folder> --<question> <choice>`), where its check runs, and copy the files back. Add a test to `cli/test/create.test.ts` that creates a game with it.
