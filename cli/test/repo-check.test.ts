import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { exportIndex, scopeOf, shorten, templatesOf, withoutGitEnv } from "../../scripts/repo-check.ts";
import { stagedFiles, stateId } from "../../scripts/state.ts";
import { stateId as templateStateId } from "../template/typescript/base/.agents/hooks/fingerprint.ts";

const temps: string[] = [];
const tempDir = () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-check-"));
	temps.push(dir);
	return dir;
};
after(() => {
	for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
});

test("a change to the CLI, a template or the tooling needs the whole check", () => {
	assert.equal(scopeOf(["cli/src/domain/game/app-name.ts"]), "full");
	assert.equal(scopeOf(["cli/template/typescript/base/AGENTS.md"]), "full", "a template's Markdown ships in games");
	assert.equal(scopeOf(["www/src/content/docs/faq.md", "cli/src/main.ts"]), "full");
	assert.equal(scopeOf([".github/scripts/run-games.ts"]), "full");
	assert.equal(scopeOf(["turbo.json", "AGENTS.md"]), "full");
});

test("a docs change needs the docs site and the tests that read the docs, not the whole CLI", () => {
	assert.equal(scopeOf(["www/src/content/docs/faq.md"]), "docs");
	assert.equal(scopeOf(["www/src/site.ts"]), "docs");
	assert.equal(scopeOf(["README.md"]), "docs");
	assert.equal(scopeOf(["cli/README.md", "www/astro.config.ts"]), "docs");
});

test("Markdown that nothing reads needs no check", () => {
	assert.equal(scopeOf([]), "none");
	assert.equal(scopeOf(["AGENTS.md", "CONTRIBUTING.md", ".changeset/quiet-lions.md", "cli/CHANGELOG.md"]), "none");
	assert.equal(scopeOf(["AGENTS.md", "cli/src/main.ts"]), "full");
});

test("a template's check runs when its code changed, not only its Markdown", () => {
	assert.deepEqual(templatesOf(["cli/src/main.ts", "www/src/site.ts"]), []);
	assert.deepEqual(templatesOf(["cli/template/luau/base/src/a.luau"]), ["cli/template/luau/base"]);
	assert.deepEqual(templatesOf(["cli/template/typescript/base/AGENTS.md"]), []);
	assert.deepEqual(
		templatesOf(["cli/template/typescript/base/AGENTS.md", "cli/template/typescript/base/scripts/doc.ts"]),
		["cli/template/typescript/base"],
	);
	assert.deepEqual(templatesOf(["cli/template/typescript/extras/data/lapis/addon.json"]), [], "add-ons have no check");
});

test("a failure is shortened to its end, without colors", () => {
	assert.equal(shorten("\u001b[31mfail\u001b[0m\n"), "fail");
	const long = Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n");
	const short = shorten(long, 200);
	assert.ok(short.length <= 210);
	assert.ok(short.startsWith("...\nline "));
	assert.ok(short.endsWith("line 499"));
});

test("a failure drops progress dots, turbo's banner and the test runner's frames", () => {
	const output = [
		"$ turbo run build typecheck test",
		"\u2022 turbo 2.11.10",
		"   \u2022 Packages in scope: create-baseplate, www",
		"create-baseplate:test: ....................",
		"create-baseplate:test: ................X",
		"create-baseplate:test: \u2716 the probe fails (2.4ms)",
		"create-baseplate:test:   2 !== 3",
		"create-baseplate:test:       at TestContext.<anonymous> (file:///x/zz.test.ts:5:9)",
		"create-baseplate:test:       at Test.run (node:internal/test_runner/test:1402:25)",
		" Failed:    create-baseplate#test",
	].join("\n");
	assert.equal(
		shorten(output),
		[
			"$ turbo run build typecheck test",
			"create-baseplate:test: \u2716 the probe fails (2.4ms)",
			"create-baseplate:test:   2 !== 3",
			"create-baseplate:test:       at TestContext.<anonymous> (file:///x/zz.test.ts:5:9)",
			" Failed:    create-baseplate#test",
		].join("\n"),
	);
});

test("checks what is staged, not what is on disk", () => {
	const repo = tempDir();
	const git = (...args: string[]) => spawnSync("git", args, { cwd: repo, encoding: "utf8" });
	git("init", "--quiet");
	fs.writeFileSync(path.join(repo, ".gitignore"), "node_modules/\n");
	fs.writeFileSync(path.join(repo, "a.txt"), "good\n");
	fs.writeFileSync(path.join(repo, "package.json"), "{}\n");
	fs.mkdirSync(path.join(repo, "node_modules"));
	git("add", "-A");
	fs.writeFileSync(path.join(repo, "a.txt"), "edited after staging\n");
	fs.writeFileSync(path.join(repo, "untracked.txt"), "x\n");
	const dir = path.join(tempDir(), "staged");
	const { installed } = exportIndex(repo, dir);
	assert.equal(fs.readFileSync(path.join(dir, "a.txt"), "utf8"), "good\n");
	assert.ok(!fs.existsSync(path.join(dir, "untracked.txt")));
	assert.equal(installed, true);
	assert.ok(fs.lstatSync(path.join(dir, "node_modules")).isSymbolicLink(), "installed packages are linked in");
	assert.equal(fs.readFileSync(path.join(repo, "a.txt"), "utf8"), "edited after staging\n", "the disk is untouched");
});

test("a staged change to what decides the installed packages is installed again, not linked", () => {
	const repo = tempDir();
	const git = (...args: string[]) => spawnSync("git", args, { cwd: repo, encoding: "utf8" });
	git("init", "--quiet");
	fs.writeFileSync(path.join(repo, "package.json"), "{}\n");
	fs.mkdirSync(path.join(repo, "node_modules"));
	git("add", "-A");
	fs.writeFileSync(path.join(repo, "package.json"), '{"name":"x"}\n');
	const { installed } = exportIndex(repo, path.join(tempDir(), "staged"));
	assert.equal(installed, false);
});

test("a state has the id a created game's fingerprint gives it, since the Stop hook reads that record", () => {
	const repo = tempDir();
	const git = (...args: string[]) => spawnSync("git", args, { cwd: repo, encoding: "utf8" });
	git("init", "--quiet");
	fs.writeFileSync(path.join(repo, "a.txt"), "one\n");
	git("add", "-A");
	fs.writeFileSync(path.join(repo, "b.txt"), "two\n");
	assert.ok(stateId(repo, "files"));
	assert.equal(stateId(repo, "files"), templateStateId(repo, "files"));
	assert.equal(stateId(repo, "index"), templateStateId(repo, "index"));
	assert.notEqual(stateId(repo, "files"), stateId(repo, "index"));
	assert.deepEqual(stagedFiles(repo), ["a.txt"]);
});

test("the copy of the staged files is its own repository even when a hook's git variables are set", () => {
	const repo = tempDir();
	const git = (...args: string[]) => spawnSync("git", args, { cwd: repo, encoding: "utf8" });
	git("init", "--quiet");
	fs.writeFileSync(path.join(repo, "a.txt"), "x\n");
	git("add", "-A");
	const dir = path.join(tempDir(), "staged");
	const saved = { GIT_DIR: process.env.GIT_DIR, GIT_INDEX_FILE: process.env.GIT_INDEX_FILE };
	process.env.GIT_DIR = path.join(repo, ".git");
	process.env.GIT_INDEX_FILE = path.join(repo, ".git", "index");
	try {
		exportIndex(repo, dir);
	} finally {
		for (const [name, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
	}
	const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: dir, encoding: "utf8", env: withoutGitEnv() });
	assert.equal(fs.realpathSync(top.stdout.trim()), fs.realpathSync(dir));
});
