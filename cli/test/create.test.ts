// Runs the built CLI (`pnpm build` first; turbo's test task does) without installing anything.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseNameAndPath } from "../src/utils/parseNameAndPath.ts";
import { validateAppName } from "../src/utils/validateAppName.ts";

const CLI = path.resolve(import.meta.dirname, "../dist/index.js");
const create = (cwd: string, ...args: string[]) =>
	spawnSync("node", [CLI, ...args, "--json", "--no-install"], { cwd, encoding: "utf8" });

test("creates a named project an agent can read", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const run = create(cwd, "games/coin-rush", "--no-git");
	assert.equal(run.status, 0, run.stderr);
	const result = JSON.parse(run.stdout) as { ok: boolean; name: string; dir: string; nextSteps: string[] };
	assert.equal(result.ok, true);
	assert.equal(result.name, "coin-rush");
	assert.deepEqual(result.nextSteps.slice(0, 3), ["cd games/coin-rush", "mise install", "mise run install"]);

	const dir = path.join(cwd, "games/coin-rush");
	const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
	assert.equal(JSON.parse(read("package.json")).name, "coin-rush");
	assert.equal(JSON.parse(read("default.rogen.json")).name, "coin-rush");
	assert.match(read("AGENTS.md"), /^# coin-rush\n/);
	assert.doesNotMatch(read("src/app/client/ui.storybook.ts"), /my-game/);
	assert.ok(fs.existsSync(path.join(dir, ".gitignore")), ".gitignore restored from _gitignore");
	assert.ok(!fs.existsSync(path.join(dir, "_symlinks.json")));
	assert.ok(fs.lstatSync(path.join(dir, ".claude/skills")).isSymbolicLink());
	assert.ok(fs.existsSync(path.join(dir, ".claude/skills/write-tests/SKILL.md")));
	assert.ok((fs.statSync(path.join(dir, ".githooks/pre-commit")).mode & 0o111) !== 0, "hook stays executable");
	for (const generated of ["node_modules", "out", ".env", "default.project.json"]) {
		assert.ok(!fs.existsSync(path.join(dir, generated)), `${generated} isn't copied`);
	}
});

test("makes a git repo", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const run = create(cwd, "my-game");
	assert.equal(run.status, 0, run.stderr);
	const log = spawnSync("git", ["log", "--oneline"], { cwd: path.join(cwd, "my-game"), encoding: "utf8" });
	assert.match(log.stdout, /Initial commit from create-baseplate/);
});

test("refuses a folder that has files", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	fs.mkdirSync(path.join(cwd, "taken"));
	fs.writeFileSync(path.join(cwd, "taken/file.txt"), "");
	const run = create(cwd, "taken", "--no-git");
	assert.equal(run.status, 1);
	assert.equal(JSON.parse(run.stdout).ok, false);
});

test("refuses a name npm wouldn't accept", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const run = create(cwd, "My Game", "--no-git");
	assert.equal(run.status, 1);
	assert.match(JSON.parse(run.stdout).error, /lowercase/);
});

test("names and paths", () => {
	assert.equal(parseNameAndPath("games/coin-rush/").name, "coin-rush");
	assert.equal(validateAppName("coin-rush"), undefined);
	assert.notEqual(validateAppName("_private"), undefined);
});

test("applies the chosen add-ons", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const run = create(cwd, "my-game", "--no-git", "--state", "charm", "--data", "lapis", "--entities", "jecs");
	assert.equal(run.status, 0, run.stderr);
	assert.deepEqual(JSON.parse(run.stdout).addOns, { state: "charm", data: "lapis", entities: "jecs" });

	const dir = path.join(cwd, "my-game");
	const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
	const dependencies = JSON.parse(read("package.json")).dependencies as Record<string, string>;
	for (const name of ["@rbxts/charm", "@rbxts/react-charm", "@rbxts/lapis", "@rbxts/jecs"]) {
		assert.ok(dependencies[name] !== undefined, `${name} is a dependency`);
	}
	assert.ok(fs.existsSync(path.join(dir, "src/features/player-data/server/player-data-service.ts")));
	assert.ok(fs.existsSync(path.join(dir, "tests/e2e/spinner.luau")));
	assert.match(read("src/features/clicker/client/clicker-controller.ts"), /@rbxts\/charm/);

	const main = read("src/app/server/main.server.ts");
	assert.match(
		main,
		/import "\.\.\/\.\.\/features\/player-data\/server\/player-data-service";\n[\s\S]*Flamework\.ignite\(\)/,
	);
	assert.match(main, /features\/spinner\/server\/spinner-service/);

	const agents = read("AGENTS.md");
	assert.ok(agents.indexOf("## Player data") < agents.indexOf("<!-- rogen -->"), "add-on notes come before Rogen's");
	assert.match(agents, /## State/);
	assert.match(agents, /## Entities/);
});

test("takes no add-ons by default", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const run = create(cwd, "my-game", "--no-git");
	assert.deepEqual(JSON.parse(run.stdout).addOns, { state: "none", data: "none", entities: "none" });
	assert.ok(!fs.existsSync(path.join(cwd, "my-game/src/features/player-data")));
});

test("refuses an add-on choice that doesn't exist", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const run = create(cwd, "my-game", "--no-git", "--state", "redux");
	assert.equal(run.status, 1);
	assert.match(JSON.parse(run.stdout).error, /charm, reflex, none/);
});
