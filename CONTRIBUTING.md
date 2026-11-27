# Contributing

Thanks for helping. [AGENTS.md](AGENTS.md) explains the repo's parts and how to check your work, for people and agents alike; read it first.

- **Set up:** install [mise](https://mise.jdx.dev/getting-started.html), then `mise install`, `pnpm install` and `git config core.hooksPath .githooks`, which turns on the commit hook.
- **Check:** `mise run check` at the root; in `cli/template/<language>/base`, its own `mise run check`. The commit hook runs both as needed; don't skip it.
- **A rule or a skill example:** a rule the check enforces must accept the corpus of correct code in `cli/corpus/<language>/` (`mise run try -- --corpus`; CI runs it). When you add or tighten a rule, add to the corpus the legitimate code it must let through, such as a file that rightly opts out; a skill's code example must appear in a corpus file (`cli/test/corpus.test.ts`), so it passes the check and the formatter too.
- **Changesets:** a change to `cli/src` or `cli/template` needs one: `pnpm changeset`, pick the bump, and say what changed for someone creating a game. CI fails without it.
- **Bugs:** open an issue with the `baseplate` block from your game's `package.json`; the template asks for the rest.

## A new add-on

Open an issue before you build one: say which library or tool, which question it answers, and why it's among the most used. Each choice is tested in many combinations and kept up to date, so the list stays short.

Add-ons belong to a language: a TypeScript choice and a Luau one are separate folders, each with the libraries and tools that language's developers use. A choice is a folder, `cli/template/<language>/extras/<question>/<choice>/`, holding:

- `addon.json`: the manifest, below.
- `AGENTS.md`: its section for the game's `AGENTS.md`, starting with a `## ` heading; it goes before the Rogen section.
- `files/`: copied over the game, in place. An add-on that is only packages and an `AGENTS.md` section has none.
- `mise.toml` (a tool only): its pinned tools, added to the game's `[tools]`, and its tasks, added at the end.

A new question, or a choice of an existing one, also goes in its language's list in `addOnsByLanguage` in `cli/src/installers/index.ts` (its flag, question, choices with label and hint, default and whether it allows `none`), in `www/src/content/docs/cli.md`, `add-ons.md` and `layout.md`, and in both READMEs; a test fails until the docs name it. CI creates games with every choice, alone and with the others, from that list.

### The manifest

| Field | Required | What |
| --- | --- | --- |
| `dependencies` | no | Packages to add, pinned to exact versions. TypeScript: npm packages for `package.json`'s `dependencies`, `{ "@rbxts/charm": "0.11.1" }`. Luau: Wally packages for `wally.toml`'s `[dependencies]`, by alias, `{ "Charm": "littensy/charm@=0.11.1" }`. |
| `serverDependencies` | no | Luau: Wally packages only the server loads, for `wally.toml`'s `[server-dependencies]`, such as ProfileStore. |
| `imports` | no | What a main file starts. TypeScript: side-effect imports to add after its last import, so Flamework starts what they define: `{ "src/app/server/main.server.ts": ["../../features/spinner/server/spinner-service"] }`. Luau: require expressions added to its list of services or controllers: `{ "src/app/server/Main.server.luau": ["ServerScriptService.features.spinner.SpinnerService"] }`. |
| `removeDependencies` | no | Packages the choice replaces, removed from `dependencies` or `devDependencies` (in Luau, by alias from any table of `wally.toml`). |
| `removeFiles` | no | Base files or folders the choice replaces or drops, deleted before `files/` is copied. |
| `removeMiseTasks` | no | Tasks of the game's `mise.toml` the choice removes, by name (`["sync", "publish"]`), whatever other add-ons have done to them. |
| `replaceAgentsSection` | no | The heading of the game's `AGENTS.md` section that this choice's `AGENTS.md` replaces (`"UI"`), instead of adding a section. |
| `replaceText` | no | Exact edits to the game's files: `[{ "file": "mise.toml", "from": "…", "to": "…" }]`. The CLI fails if `from` isn't there, so a template change can't silently skip an edit. |
| `byUi` | no | What changes with the UI choice: `{ "vide": { "dependencies": {…}, "agents": "AGENTS.vide.md" } }` uses those dependencies in place of `dependencies`, and that file in place of `AGENTS.md`, when the game uses Vide. |
| `byManaged` | no | What changes with the managed question: `{ "partial": { "files": "files-partial", "agents": "AGENTS.partial.md" } }` copies that folder over `files/` and uses that file in place of `AGENTS.md` when Rojo manages only the code. |
| `conflicts` | no | Choices of other questions this one can't go with, and why: `{ "ui": { "vide": "Reflex has no Vide binding: with --ui vide, choose --state charm or none." } }`. The CLI refuses the pair with that message, the prompts hide it, and CI leaves it out. |

The managed question's `partial` choice is the one add-on that changes the others: it is applied last, so its `replaceText` sees the game as the other add-ons left it, and an add-on whose files or notes name the world gives `byManaged` a variant. `--places multi` takes a variant of its notes (`AGENTS.partial.md`, `README-layout.partial.md`) and skips the world in `makeMultiPlace.ts` and `makeMultiPlaceLuau.ts` too.

Pin packages in `addon.json` and tools in the add-on's `mise.toml`, where Renovate finds them; Renovate reads Wally pins (`@=`) from Wally's registry. A tool that must skip the two-week wait goes in both `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` and Renovate's rule.

Develop the add-on in a game created by the CLI (`pnpm --filter create-baseplate build`, then `node cli/dist/index.js <folder> --language <language> --<question> <choice>`), where its check runs, and copy the files back. Add a test to `cli/test/create.test.ts` that creates a game with it.
