// The two templates share their machinery (hooks, scripts, the agent tools' settings, CI): a file
// both have is the same in both, unless it is listed below as one that differs by language.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const TEMPLATE = path.resolve(import.meta.dirname, "../template");
const SHARED = [
	".agents/hooks",
	"scripts",
	".claude",
	".codex",
	".cursor",
	".gemini",
	".githooks",
	".github",
	".devcontainer",
];
const BY_LANGUAGE = new Set([
	".agents/hooks/edited.ts",
	".agents/hooks/guard.ts",
	".agents/hooks/hooks.test.ts",
	".agents/hooks/project.test.ts",
	".agents/hooks/project.ts",
	".agents/hooks/written.test.ts",
	".claude/rules/build-ui.md",
	".claude/rules/upgrade.md",
	".claude/rules/write-tests.md",
	".cursor/rules/build-ui.mdc",
	".cursor/rules/upgrade.mdc",
	".cursor/rules/write-tests.mdc",
	".devcontainer/devcontainer.json",
	".github/instructions/build-ui.instructions.md",
	".github/instructions/upgrade.instructions.md",
	".github/instructions/write-tests.instructions.md",
	".github/renovate.json",
	".github/workflows/ci.yml",
	".github/workflows/renovate-fixups.yml",
	"scripts/check-place.luau",
	"scripts/check-sources.ts",
	"scripts/check.ts",
	"scripts/each-place.ts",
	"scripts/feature.test.ts",
	"scripts/feature.ts",
	"scripts/game-project.ts",
	"scripts/layers.test.ts",
	"scripts/layers.ts",
	"scripts/pre-commit.ts",
	"scripts/setup.ts",
	"scripts/sides.test.ts",
	"scripts/sides.ts",
	"scripts/source-rules.test.ts",
	"scripts/source-rules.ts",
	"scripts/test.ts",
	"scripts/test/jest.luau",
	"scripts/ui.ts",
	"scripts/unguarded-remotes.test.ts",
	"scripts/unguarded-remotes.ts",
]);

const files = (language: string) => {
	const base = path.join(TEMPLATE, language, "base");
	const listed = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", ...SHARED], {
		cwd: base,
		encoding: "utf8",
	});
	assert.equal(listed.status, 0, listed.stderr);
	return listed.stdout.split("\0").filter((file) => file !== "" && fs.lstatSync(path.join(base, file)).isFile());
};

test("a tooling file both templates have is the same in both, unless it differs by language", () => {
	const luau = new Set(files("luau"));
	const read = (language: string, file: string) => fs.readFileSync(path.join(TEMPLATE, language, "base", file), "utf8");
	const drifted = files("typescript").filter(
		(file) => luau.has(file) && !BY_LANGUAGE.has(file) && read("typescript", file) !== read("luau", file),
	);
	assert.deepEqual(drifted, [], "copy the change to the other template, or list the file as differing by language");
});
