// The agent files' three-way update, on its own (the pure plan) and through the built CLI.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { type Files, mergeText, planSync } from "../src/sync/agentFiles.ts";

const plan = (base: Files, ours: Files, theirs: Files) => planSync(base, ours, theirs, mergeText);

test("takes the template's change to a file the game left alone", () => {
	const result = plan({ a: "old\n" }, { a: "old\n" }, { a: "new\n" });
	assert.deepEqual(result.write, { a: "new\n" });
	assert.deepEqual(result.base, { a: "new\n" });
	assert.deepEqual(result.conflicts, []);
});

test("keeps the game's change to a file the template left alone", () => {
	const result = plan({ a: "old\n" }, { a: "mine\n" }, { a: "old\n" });
	assert.deepEqual(result.write, {});
	assert.deepEqual(result.base, { a: "old\n" });
});

test("merges changes to different lines of the same file", () => {
	const base = { a: "one\ntwo\nthree\nfour\nfive\n" };
	const ours = { a: "one\ntwo\nthree\nfour\nfive\nmy own rule\n" };
	const theirs = { a: "ONE\ntwo\nthree\nfour\nfive\n" };
	const result = plan(base, ours, theirs);
	assert.deepEqual(result.write, { a: "ONE\ntwo\nthree\nfour\nfive\nmy own rule\n" });
	assert.deepEqual(result.base, theirs);
	assert.deepEqual(result.conflicts, []);
});

test("leaves a clash to a person: the game's file stays, the template's goes beside it", () => {
	const result = plan({ a: "old\n" }, { a: "mine\n" }, { a: "new\n" });
	assert.deepEqual(result.write, { "a.baseplate-new": "new\n" });
	assert.deepEqual(result.conflicts, ["a"]);
	assert.deepEqual(result.base, { a: "new\n" }, "a person's merge of the two is kept next time");
	assert.deepEqual(plan(result.base, { a: "merged\n" }, { a: "new\n" }).write, {});
});

test("adds a file the template added, and keeps a game's file of the same name apart", () => {
	assert.deepEqual(plan({}, {}, { a: "new\n" }).write, { a: "new\n" });
	const clash = plan({}, { a: "mine\n" }, { a: "new\n" });
	assert.deepEqual(clash.write, { "a.baseplate-new": "new\n" });
	assert.deepEqual(clash.conflicts, ["a"]);
	assert.deepEqual(plan({}, { a: "same\n" }, { a: "same\n" }).base, { a: "same\n" });
});

test("deletes a file the template dropped, unless the game changed it", () => {
	const dropped = plan({ a: "old\n" }, { a: "old\n" }, {});
	assert.deepEqual(dropped.remove, ["a"]);
	assert.deepEqual(dropped.base, {});
	const changed = plan({ a: "old\n" }, { a: "mine\n" }, {});
	assert.deepEqual(changed.remove, []);
	assert.deepEqual(changed.base, {}, "the game's own file from now on");
});

test("doesn't bring back a file the game deleted", () => {
	const result = plan({ a: "old\n" }, {}, { a: "new\n" });
	assert.deepEqual(result.write, {});
	assert.deepEqual(result.base, { a: "new\n" }, "remembered, so the next update doesn't add it either");
});

test("refreshes an earlier clash no one merged, and drops it once the files agree", () => {
	const stale = planSync({ a: "t1\n" }, { a: "mine\n" }, { a: "t2\n" }, () => undefined, ["a"]);
	assert.equal(stale.write["a.baseplate-new"], "t2\n");
	assert.deepEqual(stale.conflicts, ["a"]);
	const settled = planSync({ a: "t1\n" }, { a: "t2\n" }, { a: "t2\n" }, mergeText, ["a"]);
	assert.deepEqual(settled.remove, ["a.baseplate-new"]);
	assert.deepEqual(settled.conflicts, []);
});

// Through the built CLI (`pnpm build` first; turbo's test task does).
const CLI = path.resolve(import.meta.dirname, "../dist/index.js");
const BASE = ".baseplate/agent-files.json";

const temps: string[] = [];
after(() => {
	for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
});
const createGame = (...args: string[]) => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "baseplate-sync-"));
	temps.push(cwd);
	const run = spawnSync("node", [CLI, "game", "--json", "--no-install", "--no-git", ...args], {
		cwd,
		encoding: "utf8",
	});
	assert.equal(run.status, 0, run.stderr);
	return path.join(cwd, "game");
};
const sync = (dir: string, ...args: string[]) =>
	spawnSync("node", [CLI, "sync", ...args], { cwd: dir, encoding: "utf8" });
const readBase = (dir: string) =>
	JSON.parse(fs.readFileSync(path.join(dir, BASE), "utf8")) as { version: string; files: Files };

test("a new game records its agent files as the template made them", () => {
	const dir = createGame("--places", "multi");
	const { version, files } = readBase(dir);
	const cli = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../package.json"), "utf8"));
	assert.equal(version, cli.version);
	assert.equal(files["AGENTS.md"], fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8"));
	assert.ok(files[".agents/skills/write-tests/SKILL.md"]);
	assert.ok(files[".claude/settings.json"]);
	assert.ok(!Object.keys(files).some((file) => file.startsWith("src/") || file.startsWith("projects/")));
	assert.ok(!(".claude/skills" in files), "the link isn't a file");
	const check = sync(dir, "--check");
	assert.equal(check.status, 0, check.stdout + check.stderr);
});

test("a Luau game keeps the Luau template's agent files", () => {
	const dir = createGame("--language", "luau");
	const { files } = readBase(dir);
	assert.ok(files[".claude/plugins/luau/.claude-plugin/plugin.json"], "the Luau language server");
	assert.ok(!files[".claude/plugins/roblox-ts/.claude-plugin/plugin.json"]);
	assert.match(files["AGENTS.md"] ?? "", /A Roblox game in Luau/);
	const check = sync(dir, "--check");
	assert.equal(check.status, 0, check.stdout + check.stderr);
});

test("a game made before the language question syncs as TypeScript", () => {
	const dir = createGame();
	const file = path.join(dir, "package.json");
	const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
	assert.equal(pkg.baseplate.language, "typescript");
	delete pkg.baseplate.language;
	fs.writeFileSync(file, `${JSON.stringify(pkg, undefined, "\t")}\n`);
	const check = sync(dir, "--check");
	assert.equal(check.status, 0, check.stdout + check.stderr);
});

test("updates a game's agent files from an older template, keeping its own edits", () => {
	const dir = createGame("--state", "charm");
	const base = readBase(dir);
	const skill = ".agents/skills/write-tests/SKILL.md";
	const current = base.files[skill] ?? "";
	// As if an older create-baseplate made the game: its skill read differently, and it shipped a
	// file this one dropped. The game's AGENTS.md has a rule of its own at the end.
	const older = current.replace("# ", "# Old ");
	base.files[skill] = older;
	base.files[".agents/skills/gone/SKILL.md"] = "dropped\n";
	base.version = "0.0.1";
	fs.writeFileSync(path.join(dir, BASE), JSON.stringify(base));
	fs.writeFileSync(path.join(dir, skill), older);
	fs.mkdirSync(path.join(dir, ".agents/skills/gone"));
	fs.writeFileSync(path.join(dir, ".agents/skills/gone/SKILL.md"), "dropped\n");
	fs.appendFileSync(path.join(dir, "AGENTS.md"), "\n## House rules\n\nOne of ours.\n");

	assert.equal(sync(dir, "--check").status, 1, "out of date");
	const run = sync(dir);
	assert.equal(run.status, 0, run.stdout + run.stderr);
	assert.equal(fs.readFileSync(path.join(dir, skill), "utf8"), current);
	assert.ok(!fs.existsSync(path.join(dir, ".agents/skills/gone")), "dropped, and its folder with it");
	assert.match(fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8"), /## House rules\n\nOne of ours\.\n$/);
	assert.match(run.stdout, /write-tests\/SKILL\.md/);
	assert.notEqual(readBase(dir).version, "0.0.1");
	assert.equal(sync(dir, "--check").status, 0, "up to date now");
});

test("keeps a new hook executable, and leaves an agent's worktree inside the game alone", () => {
	const dir = createGame();
	const base = readBase(dir);
	const hook = ".agents/hooks/run";
	// As if the hook were new in this version: the game and its base lack it.
	delete base.files[hook];
	fs.writeFileSync(path.join(dir, BASE), JSON.stringify(base));
	fs.rmSync(path.join(dir, hook));
	const worktree = path.join(dir, ".claude/worktrees/feature");
	fs.mkdirSync(worktree, { recursive: true });
	fs.writeFileSync(path.join(worktree, ".git"), "gitdir: elsewhere\n");
	fs.mkdirSync(path.join(worktree, ".agents"));
	fs.writeFileSync(path.join(worktree, "AGENTS.md.baseplate-new"), "theirs\n");

	const run = sync(dir);
	assert.equal(run.status, 0, run.stdout + run.stderr);
	assert.ok((fs.statSync(path.join(dir, hook)).mode & 0o111) !== 0, "still executable");
	assert.ok(!(".claude/worktrees/feature/AGENTS.md" in readBase(dir).files));
});

test("takes `sync` as a new game's folder outside a game", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "baseplate-sync-"));
	temps.push(cwd);
	const run = spawnSync("node", [CLI, "sync", "--json", "--no-install", "--no-git"], { cwd, encoding: "utf8" });
	assert.equal(run.status, 0, run.stdout + run.stderr);
	assert.ok(fs.existsSync(path.join(cwd, "sync", "AGENTS.md")));
});

test("stops on a clash, leaving the template's version beside the game's", () => {
	const dir = createGame();
	const base = readBase(dir);
	const file = ".agents/skills/edit-world/SKILL.md";
	const current = base.files[file] ?? "";
	const firstLine = current.split("\n")[0] ?? "";
	base.files[file] = current.replace(firstLine, `${firstLine} (old)`);
	fs.writeFileSync(path.join(dir, BASE), JSON.stringify(base));
	fs.writeFileSync(path.join(dir, file), current.replace(firstLine, `${firstLine} (ours)`));

	const run = sync(dir);
	assert.equal(run.status, 1);
	assert.match(run.stdout, /edit-world\/SKILL\.md/);
	assert.equal(fs.readFileSync(path.join(dir, `${file}.baseplate-new`), "utf8"), current);
	assert.equal(sync(dir, "--check").status, 1, "the clash stays until a person settles it");
});
