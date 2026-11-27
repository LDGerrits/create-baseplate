#!/usr/bin/env node
import { createRequire } from "node:module";
import { DOCS_DIR } from "./base/template.ts";
import { runCreate } from "./commands/create/create-command.ts";
import { runDoc } from "./commands/doc/doc-command.ts";
import { isGame, runSync } from "./commands/sync/sync-command.ts";

const { version } = createRequire(import.meta.url)("../package.json") as { version: string };
// Baseplate's CI and `mise run try` keep the tests of the template's own tooling in the games they make.
const keepToolingTests = process.env.BASEPLATE_TOOLING_TESTS === "1";

// `create-baseplate sync [--check]`, in a game: update its agent files to this version's template.
// Elsewhere, `sync` is the folder of a new game.
if (process.argv[2] === "sync" && isGame(process.cwd())) {
	process.exit(runSync(process.cwd(), version, process.argv.includes("--check"), keepToolingTests));
}
// `create-baseplate doc [topic]`: this version's docs, offline. A game named doc is `./doc`.
if (process.argv[2] === "doc") process.exit(runDoc(DOCS_DIR, process.argv.slice(3)));
await runCreate(version, keepToolingTests);
