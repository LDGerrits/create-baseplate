import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { stripVTControlCharacters } from "node:util";
import { CLI, create, GIT_IDENTITY, tempDir } from "./helpers.ts";

test("creates a named project an agent can read", () => {
	const cwd = tempDir();
	const run = create(cwd, "games/coin-rush", "--no-git", "--language", "typescript", "--state", "none");
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

for (const language of ["typescript", "luau"]) {
	test(`${language}: leaves the tooling's own tests out of the game, unless BASEPLATE_TOOLING_TESTS=1 keeps them`, () => {
		const cwd = tempDir();
		const testsIn = (game: string) =>
			[".agents/hooks", "scripts"].flatMap((folder) =>
				fs.readdirSync(path.join(cwd, game, folder)).filter((file) => file.endsWith(".test.ts")),
			);
		const { BASEPLATE_TOOLING_TESTS: _, ...env } = process.env;
		for (const [game, keep] of [
			["lean", undefined],
			["kept", "1"],
		] as const) {
			const run = spawnSync(
				"node",
				[CLI, game, "--language", language, "--managed", "partial", "--json", "--no-install", "--no-git"],
				{ cwd, encoding: "utf8", env: keep === undefined ? env : { ...env, BASEPLATE_TOOLING_TESTS: keep } },
			);
			assert.equal(run.status, 0, run.stderr);
		}
		assert.deepEqual(testsIn("lean"), []);
		assert.ok(testsIn("kept").includes("hooks.test.ts"), "kept, with the add-ons' edits");
	});
}

test("records which CLI and add-ons made the game", () => {
	const cwd = tempDir();
	const run = create(cwd, "coin-rush", "--no-git", "--language", "typescript", "--state", "charm");
	assert.equal(run.status, 0, run.stderr);
	const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "coin-rush/package.json"), "utf8"));
	const cli = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../package.json"), "utf8"));
	assert.equal(pkg.baseplate.version, cli.version);
	assert.equal(pkg.baseplate.language, "typescript");
	assert.equal(pkg.baseplate.addOns.state, "charm");
	assert.equal(pkg.baseplate.addOns.ui, "react");
	assert.doesNotMatch(pkg.description ?? "", /template/i, "a game, not the template");
});

test("makes a git repo", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--state", "none");
	assert.equal(run.status, 0, run.stderr);
	const log = spawnSync("git", ["log", "--oneline"], { cwd: path.join(cwd, "my-game"), encoding: "utf8" });
	assert.match(log.stdout, /Initial commit from create-baseplate/);
});

test("leaves the first commit until an install brings the add-ons' packages into the lockfile", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--language", "typescript", "--state", "charm");
	assert.equal(run.status, 0, run.stderr);
	const result = JSON.parse(run.stdout) as {
		git: boolean;
		committed: boolean;
		warnings: string[];
		nextSteps: string[];
	};
	assert.equal(result.git, true);
	assert.equal(result.committed, false);
	assert.match(result.warnings.join("\n"), /Nothing is committed yet/);
	const steps = result.nextSteps;
	const install = steps.indexOf("mise exec -- pnpm install --no-frozen-lockfile");
	const commit = steps.findIndex((step) => step.startsWith("git add --all && git commit"));
	assert.ok(install !== -1 && commit > install, steps.join("\n"));
	const log = spawnSync("git", ["log"], { cwd: path.join(cwd, "my-game"), encoding: "utf8" });
	assert.notEqual(log.status, 0, "no commit yet");
});

test("locks the tools an add-on brings before installing them", () => {
	const cwd = tempDir();
	const steps = (...args: string[]) => {
		const run = create(cwd, ...args, "--no-git");
		assert.equal(run.status, 0, run.stderr);
		return JSON.parse(run.stdout).nextSteps as string[];
	};
	const withTool = steps("with-darklua", "--release", "darklua");
	assert.deepEqual(withTool.slice(1, 3), ["mise lock", "mise install"]);
	assert.ok(!steps("plain").includes("mise lock"), "the template's mise.lock already covers its own tools");
});

test("leaves the first commit until mise.lock records the tools an add-on brings", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--release", "darklua");
	assert.equal(run.status, 0, run.stderr);
	const result = JSON.parse(run.stdout) as {
		git: boolean;
		committed: boolean;
		warnings: string[];
		nextSteps: string[];
	};
	assert.equal(result.git, true, result.warnings.join("\n"));
	assert.equal(result.committed, false);
	assert.match(result.warnings.join("\n"), /mise\.lock doesn't record/);
	const steps = result.nextSteps;
	const lock = steps.indexOf("mise lock");
	const commit = steps.findIndex((step) => step.startsWith("git add --all && git commit"));
	assert.ok(lock !== -1 && commit > lock, steps.join("\n"));
	const log = spawnSync("git", ["log"], { cwd: path.join(cwd, "my-game"), encoding: "utf8" });
	assert.notEqual(log.status, 0, "no commit yet");
});

test("says why the game isn't its own git repo", () => {
	const cwd = tempDir();
	spawnSync("git", ["init", "--quiet"], { cwd });
	const run = create(cwd, "my-game");
	assert.equal(run.status, 0, run.stderr);
	const result = JSON.parse(run.stdout) as { git: boolean; warnings: string[] };
	assert.equal(result.git, false);
	assert.match(result.warnings.join("\n"), /inside the git repo at .*, so it isn't a repo of its own/);
});

test("refuses flags that npm create kept for itself", () => {
	const cwd = tempDir();
	// What `npm create baseplate my-game --json --no-git --ui vide` passes on: no flags, `vide` as a
	// second argument, and the flags as npm_config_* variables.
	const run = spawnSync("node", [CLI, "my-game", "vide"], {
		cwd,
		encoding: "utf8",
		env: {
			...process.env,
			npm_command: "init",
			npm_config_json: "true",
			npm_config_git: "false",
			npm_config_ui: "true",
		},
	});
	assert.equal(run.status, 2);
	const result = JSON.parse(run.stdout) as { ok: boolean; error: string };
	assert.equal(result.ok, false);
	assert.match(result.error, /npm read --json, --no-git, --ui as its own options/);
	assert.match(result.error, /npm create baseplate@latest my-game -- --yes/);
	assert.ok(!fs.existsSync(path.join(cwd, "my-game")), "creates nothing");
});

test("quotes the folder in the next steps", () => {
	const cwd = tempDir();
	const run = create(cwd, "My Games/coin-rush", "--no-git");
	assert.equal(run.status, 0, run.stderr);
	assert.equal(JSON.parse(run.stdout).nextSteps[0], "cd 'My Games/coin-rush'");
});

test("creates into a freshly cloned repo, and commits there", () => {
	const cwd = tempDir();
	const dir = path.join(cwd, "coin-rush");
	const git = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
	// What GitHub's "Create repository" with a README and a license, then a clone, leaves.
	fs.mkdirSync(dir);
	git("init", "--quiet", "--initial-branch", "main");
	fs.writeFileSync(path.join(dir, "README.md"), "# coin-rush\n");
	fs.writeFileSync(path.join(dir, "LICENSE"), "My license\n");
	git("add", "--all");
	git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "--message", "Initial commit");

	const run = create(cwd, "coin-rush", "--state", "none");
	assert.equal(run.status, 0, run.stderr);
	const result = JSON.parse(run.stdout) as { ok: boolean; git: boolean; committed: boolean; warnings: string[] };
	assert.equal(result.ok, true);
	assert.equal(result.git, true);
	assert.equal(result.committed, true);
	assert.equal(fs.readFileSync(path.join(dir, "LICENSE"), "utf8"), "My license\n", "keeps the repo's license");
	assert.match(fs.readFileSync(path.join(dir, "README.md"), "utf8"), /^# coin-rush\n\nA Roblox game/m);
	assert.match(result.warnings.join("\n"), /Replaced README\.md/);
	assert.match(git("log", "--oneline").stdout, /Initial commit from create-baseplate\n.*Initial commit\n/);
});

test("exits non-zero when the first commit fails, leaving the game uncommitted", () => {
	const cwd = tempDir();
	const hooks = path.join(cwd, "hooks");
	fs.mkdirSync(hooks);
	fs.writeFileSync(
		path.join(hooks, "pre-commit"),
		"#!/bin/sh\necho 'check failed: lint error in src/a.ts' >&2\nexit 1\n",
		{
			mode: 0o755,
		},
	);
	const env = {
		...process.env,
		...GIT_IDENTITY,
		GIT_CONFIG_COUNT: "1",
		GIT_CONFIG_KEY_0: "core.hooksPath",
		GIT_CONFIG_VALUE_0: hooks,
	};

	const json = spawnSync("node", [CLI, "coin-rush", "--json", "--no-install", "--state", "none"], {
		cwd,
		encoding: "utf8",
		env,
	});
	assert.equal(json.status, 1);
	const result = JSON.parse(json.stdout) as {
		ok: boolean;
		created: boolean;
		committed: boolean;
		dir: string;
		error: string;
		nextSteps: string[];
	};
	assert.equal(result.ok, false);
	assert.equal(result.created, true);
	assert.equal(result.committed, false);
	assert.match(result.error, /first commit failed/);
	assert.match(result.error, /lint error in src\/a\.ts/);
	assert.ok(result.nextSteps.includes('git add --all && git commit --message "Initial commit from create-baseplate"'));
	assert.ok(fs.existsSync(path.join(result.dir, "AGENTS.md")), "the game stays");
	assert.notEqual(spawnSync("git", ["log"], { cwd: result.dir }).status, 0, "no commit");

	const text = spawnSync("node", [CLI, "second", "--yes", "--no-install", "--state", "none"], {
		cwd,
		encoding: "utf8",
		env,
	});
	assert.equal(text.status, 1);
	assert.match(
		stripVTControlCharacters(text.stderr + text.stdout),
		/first commit failed[\s\S]*git add --all && git commit/,
	);
});

test("names the game apart from its folder with --name", () => {
	const cwd = tempDir();
	const run = create(cwd, "Coin Rush", "--name", "coin-rush", "--no-git");
	assert.equal(run.status, 0, run.stderr);
	const result = JSON.parse(run.stdout) as { name: string; dir: string };
	assert.equal(result.name, "coin-rush");
	assert.equal(path.basename(result.dir), "Coin Rush");
	assert.equal(JSON.parse(fs.readFileSync(path.join(cwd, "Coin Rush/package.json"), "utf8")).name, "coin-rush");
});
