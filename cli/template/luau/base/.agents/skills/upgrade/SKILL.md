---
name: upgrade
description: Update the game's tools and packages, or bring its agent files up to a new create-baseplate version. Use for a Renovate pull request, a `.baseplate-new` file, a failing `agent-files` check, or a tool or package update.
---

# Upgrade

## Agent files (`.baseplate-new`)

`AGENTS.md`, the skills, the hooks and the agent tools' settings follow the create-baseplate version in `package.json`'s `baseplate.version`. `mise run install` runs `create-baseplate sync` when the pin moved. Where the game's edit and the template's change touch the same lines, the game's file stays and the template's version sits beside it as `<file>.baseplate-new`; the check fails until you merge it.

1. For each `*.baseplate-new`, read it next to its file: `git diff --no-index <file> <file>.baseplate-new`.
2. Keep the game's own lines, take the template's change, and write the merged result to `<file>`. When the two disagree about the same rule, the game's wins; when the template's text is plainly newer, such as a command or flag that was renamed, take it.
3. Delete the `.baseplate-new` file, then run `mise run check`. Don't edit `.baseplate/agent-files.json`: the sync records what the template wrote.

`node scripts/agent-files.ts --check` says whether the files lag the pin or a clash is left, and changes nothing; `mise run install` brings them up to the pin.

## Tools

A tool's pin in `mise.toml` is locked: `mise install` refuses a tool the lock doesn't list. The edit hook runs `mise lock` after each change to `mise.toml` (in a tool without hooks, run it yourself), and Renovate's branches do it in CI.

- **Rojo** is pinned to a version rbx-forge supports, because forge patches Rojo's Studio plugin. Before a Rojo update, check forge's release notes for support of the new version, and test `mise run dev`.
- **Rogen, rbx-forge** update from npm in `package.json`. After one, run `mise run check`. Rogen keeps its own block in `AGENTS.md` as it writes it, so `git diff` after the check may show it changed: commit that with the update.

## Packages

Wally packages are pinned in `wally.toml` and recorded in `wally.lock`; after changing one, run `mise run install`, which runs `wally install`, and commit the lock. Never edit `Packages/`, `ServerPackages/` or `DevPackages/`: Wally writes them. Node tools (`pnpm add -D <name>`) install only versions published at least two weeks ago; when pnpm refuses one, pick an older version. After an update, run `mise run check` and play the parts that use it.
