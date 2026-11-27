import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { create, tempDir } from "./helpers.ts";

for (const language of ["typescript", "luau"]) {
	test(`${language}: a partially managed game has no world, publishing or edit-world skill`, () => {
		const cwd = tempDir();
		const run = create(
			cwd,
			"my-game",
			"--no-git",
			"--language",
			language,
			"--managed",
			"partial",
			"--entities",
			"jecs",
		);
		assert.equal(run.status, 0, run.stderr);
		const dir = path.join(cwd, "my-game");
		const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
		const exists = (file: string) => fs.existsSync(path.join(dir, file));
		assert.equal(JSON.parse(read("package.json")).baseplate.addOns.managed, "partial");

		for (const gone of [
			"world",
			"scripts/publish.ts",
			"scripts/publish.test.ts",
			"scripts/world-types.ts",
			".github/workflows/publish.yml",
			".agents/skills/edit-world",
		]) {
			assert.ok(!exists(gone), `${gone} is gone`);
		}
		const mise = read("mise.toml");
		assert.doesNotMatch(mise, /\[tasks\.(sync|publish|"publish:build")\]|ROJO_SYNCBACK_DEBUG|syncback/);
		assert.match(mise, /scripts\/dev\.ts/);
		assert.doesNotMatch(read(".env.example"), /ROBLOX_PUBLISH/);
		assert.match(read(".env.example"), /ROBLOX_OPEN_CLOUD_API_KEY/, "the engine tests keep their key");
		assert.doesNotMatch(read(".agents/hooks/guard.ts"), /publish\.ts|world/);
		assert.match(read(".agents/hooks/guard.ts"), /rojo\\s\+upload/, "uploading stays blocked");

		const agents = read("AGENTS.md");
		assert.match(agents, /## World and Studio\n\nStudio owns this game's place and its world/);
		assert.match(agents, /WaitForChild/);
		assert.match(agents, /drive-studio/);
		assert.doesNotMatch(agents, /edit-world|`mise run publish`|world\.d\.ts|Spinner\.model\.json/);
		assert.match(read(".agents/skills/release/SKILL.md"), /published from Studio/);
		assert.doesNotMatch(read(".agents/skills/drive-studio/SKILL.md"), /edit-world|--syncback/);
		assert.match(read("tests/e2e/spinner.luau"), /Instance\.new\("Part"\)/);
	});

	test(`${language}: a fully managed game keeps its world, publishing and edit-world skill`, () => {
		const cwd = tempDir();
		const run = create(cwd, "my-game", "--no-git", "--language", language, "--managed", "full", "--entities", "jecs");
		assert.equal(run.status, 0, run.stderr);
		const dir = path.join(cwd, "my-game");
		for (const kept of [
			"world/default.project.json",
			"world/Workspace/Spinner.model.json",
			"scripts/publish.ts",
			".github/workflows/publish.yml",
			".agents/skills/edit-world/SKILL.md",
		]) {
			assert.ok(fs.existsSync(path.join(dir, kept)), `${kept} is kept`);
		}
		assert.match(fs.readFileSync(path.join(dir, "mise.toml"), "utf8"), /\[tasks\.sync\]/);
	});

	test(`${language}: a partially managed multi-place game has no world in any place`, () => {
		const cwd = tempDir();
		const run = create(
			cwd,
			"my-game",
			"--no-git",
			"--language",
			language,
			"--managed",
			"partial",
			"--places",
			"multi",
			"--entities",
			"jecs",
			"--assets",
			"asphalt",
		);
		assert.equal(run.status, 0, run.stderr);
		const dir = path.join(cwd, "my-game");
		for (const place of ["lobby", "game"]) {
			assert.ok(!fs.existsSync(path.join(dir, "projects", place, "world")), `${place} has no world`);
			assert.ok(fs.existsSync(path.join(dir, "projects", place, "rbx-forge.config.ts")));
		}
		const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
		assert.doesNotMatch(read("AGENTS.md"), /world\/(Workspace|Lighting|default)|mise run sync|world\.d\.ts/);
		assert.doesNotMatch(read("README.md"), /mise run sync/);
		assert.doesNotMatch(read(".gitignore"), /world/);
		assert.match(read(".agents/skills/release/SKILL.md"), /^# .+\n\n> This game has several places/m);
	});
}

for (const [label, args] of [
	["a roblox-ts game", ["--language", "typescript", "--data", "lapis", "--entities", "jecs", "--assets", "asphalt"]],
	[
		"a multi-place roblox-ts game",
		[
			"--language",
			"typescript",
			"--places",
			"multi",
			"--data",
			"profilestore",
			"--entities",
			"components",
			"--assets",
			"asphalt",
		],
	],
	["a Luau game", ["--language", "luau", "--data", "lapis", "--entities", "jecs", "--assets", "asphalt"]],
	[
		"a multi-place Luau game",
		["--language", "luau", "--places", "multi", "--data", "profilestore", "--assets", "asphalt"],
	],
] as const) {
	test(`keeps every file of ${label} inside the layers`, () => {
		const cwd = tempDir();
		const run = create(cwd, "my-game", "--no-git", ...args);
		assert.equal(run.status, 0, run.stderr);
		const dir = path.join(cwd, "my-game");
		const script = `
			import fs from "node:fs";
			import path from "node:path";
			import { structureErrors } from "./scripts/layers.ts";
			const multi = fs.existsSync("projects");
			const roots = multi
				? ["projects/common/src", ...fs.readdirSync("projects").filter((p) => fs.existsSync("projects/" + p + "/src")).map((p) => "projects/" + p + "/src")]
				: ["src"];
			const files = (dir) => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(path.posix.join(dir, e.name)) : /\\.(tsx?|luau?)$/.test(e.name) && !e.name.endsWith(".d.ts") ? [path.posix.join(dir, e.name)] : []);
			console.log(JSON.stringify(structureErrors(roots.flatMap(files), [...new Set(roots)])));
		`;
		const check = spawnSync("node", ["--input-type=module", "-e", script], { cwd: dir, encoding: "utf8" });
		assert.equal(check.status, 0, check.stderr);
		assert.deepEqual(JSON.parse(check.stdout), []);
		for (const layer of ["Where code goes"])
			assert.match(fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8"), new RegExp(`## ${layer}`));
		assert.match(
			fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8"),
			/`app`, then `features`, then `game`, then `platform`|app`, then `features`/,
		);
	});
}
