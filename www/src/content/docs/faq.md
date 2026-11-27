---
title: FAQ
description: Keeping a game up to date, npm and yarn, Studio, removing an add-on, and which agents it works with.
---

## How do I keep my game up to date?

The game's tools and packages, with Renovate: `.github/renovate.json` proposes updates two weeks after each release, and the game's CI checks each one before it merges. A tool's pin also needs its checksums in `mise.lock`, which `.github/workflows/renovate-fixups.yml` adds on Renovate's branches.

The template's agent files (`AGENTS.md`, the skills, the hooks and the agent tools' settings) follow the create-baseplate version in `package.json`'s `baseplate.version`: Renovate moves it, and `create-baseplate sync` brings them up to that version, keeping your edits (see [keeping the agent files current](/agents/#keeping-the-agent-files-current)). The rest of the template, no: there's no command for it, and once created, the game is yours. Its `package.json` records where it started:

```json
"baseplate": {
	"version": "0.1.0",
	"language": "luau",
	"addOns": { "ui": "vide", "places": "single", "managed": "full", "state": "charm", "data": "none", "entities": "none", "assets": "none", "release": "none" }
}
```

To take a later improvement, create a game with the same add-ons from the old and the new version (`pnpm create baseplate@<version> …`), compare the two, and apply what you want. `cli/CHANGELOG.md` in Baseplate's repository says what each release changed.

## Can I use npm or yarn?

To create a game, yes: `npm create baseplate@latest my-game -- --yes`. Inside the game, no. It's built on pnpm: the lockfile is `pnpm-lock.yaml`, `pnpm-workspace.yaml` holds the two-week rule, the overrides and the hoisted layout roblox-ts needs, and the tasks run pnpm. npm or yarn would ignore all of that and install versions the lockfile doesn't name. mise installs the pinned pnpm, so there's nothing to set up, and the agents' guard blocks npm, yarn and npx, saying to use pnpm.

## Does it need Roblox Studio?

Not for the loop: `mise run check`, the tests (in ree) and the UI pictures (with rur) run without it, on Linux, macOS, Windows and in cloud agents. Studio is needed to edit the map and play the game (`mise run dev`), to run the specs in a real engine locally (`mise run test:engine`; CI uses Open Cloud instead), and for text in the UI pictures, which rur draws with Studio's fonts. See [the world and Studio](/world-and-studio/).

## How do I remove an add-on?

By hand; [Add-ons](/add-ons/) lists what each one adds and how to take it out. The quickest way to see what one changed is to create two games, one without it, and compare them.

## Which agents does it work with?

Claude Code, Codex, Cursor, GitHub Copilot and Gemini CLI read `AGENTS.md` (Claude Code through `.claude/CLAUDE.md`, Gemini CLI through `.gemini/settings.json`) and the skills in `.agents/skills/`. [How agents work in it](/agents/) says which hooks each one runs. Any other agent that reads `AGENTS.md` and runs shell commands works too: what matters is that it runs `mise run check`.

## Can I use Luau instead of TypeScript?

Yes, and it's the default: the language is the first question the CLI asks, and `--language typescript` makes a roblox-ts game instead. A Luau game has its own template with the tools Luau developers use (Wally, StyLua, Selene, luau-lsp) and the same checks, hooks, tests and skills. See [Luau games](/luau/). A game can't switch languages once created.
