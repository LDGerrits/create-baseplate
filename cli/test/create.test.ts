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

test("leaves the first commit until an install brings the add-ons' packages into the lockfile", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const run = create(cwd, "my-game", "--state", "charm");
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
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const steps = (...args: string[]) => {
		const run = create(cwd, ...args, "--no-git");
		assert.equal(run.status, 0, run.stderr);
		return JSON.parse(run.stdout).nextSteps as string[];
	};
	const withTool = steps("with-darklua", "--release", "darklua");
	assert.deepEqual(withTool.slice(1, 3), ["mise lock", "mise install"]);
	assert.ok(!steps("plain").includes("mise lock"), "the template's mise.lock already covers its own tools");
});

test("says why the game isn't its own git repo", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	spawnSync("git", ["init", "--quiet"], { cwd });
	const run = create(cwd, "my-game");
	assert.equal(run.status, 0, run.stderr);
	const result = JSON.parse(run.stdout) as { git: boolean; warnings: string[] };
	assert.equal(result.git, false);
	assert.match(result.warnings.join("\n"), /inside the git repo at .*, so it isn't a repo of its own/);
});

test("refuses flags that npm create kept for itself", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
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
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const run = create(cwd, "My Games/coin-rush", "--no-git");
	assert.equal(run.status, 0, run.stderr);
	assert.equal(JSON.parse(run.stdout).nextSteps[0], "cd 'My Games/coin-rush'");
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
	assert.deepEqual(JSON.parse(run.stdout).addOns, {
		ui: "react",
		places: "single",
		state: "charm",
		data: "lapis",
		entities: "jecs",
		assets: "none",
		release: "none",
	});

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
	assert.deepEqual(JSON.parse(run.stdout).addOns, {
		ui: "react",
		places: "single",
		state: "none",
		data: "none",
		entities: "none",
		assets: "none",
		release: "none",
	});
	const mise = fs.readFileSync(path.join(cwd, "my-game/mise.toml"), "utf8");
	assert.doesNotMatch(mise, /asphalt|darklua/);
	assert.ok(!fs.existsSync(path.join(cwd, "my-game/src/features/player-data")));
});

test("refuses an add-on choice that doesn't exist", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const run = create(cwd, "my-game", "--no-git", "--state", "redux");
	assert.equal(run.status, 1);
	assert.match(JSON.parse(run.stdout).error, /charm, reflex, none/);
});

test("swaps React for Vide", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const run = create(cwd, "my-game", "--no-git", "--ui", "vide");
	assert.equal(run.status, 0, run.stderr);

	const dir = path.join(cwd, "my-game");
	const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
	const pkg = JSON.parse(read("package.json")) as Record<string, Record<string, string>>;
	const all = { ...pkg.dependencies, ...pkg.devDependencies };
	assert.ok(all["@rbxts/vide"] !== undefined);
	for (const react of ["@rbxts/react", "@rbxts/react-roblox", "@rbxts/pretty-react-hooks", "eslint-plugin-react-x"]) {
		assert.equal(all[react], undefined, `${react} is gone`);
	}
	assert.ok(!fs.existsSync(path.join(dir, "src/app/client/react-dev.ts")));
	assert.match(read("tsconfig.json"), /"jsxFactory": "Vide\.jsx"/);
	assert.doesNotMatch(read("eslint.config.ts"), /react/);
	assert.match(read("src/features/clicker/client/clicker-button.story.tsx"), /CreateVideStory/);

	const agents = read("AGENTS.md");
	assert.match(agents, /and Vide for the UI/);
	assert.match(agents, /## UI\n\nVide/);
	assert.doesNotMatch(agents, /react|ripple/i, "AGENTS.md names no React package");
	assert.doesNotMatch(read("README.md"), /React DevTools/);
});

test("uses Charm's Vide binding with Vide", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const run = create(cwd, "my-game", "--no-git", "--ui", "vide", "--state", "charm");
	assert.equal(run.status, 0, run.stderr);
	const dir = path.join(cwd, "my-game");
	const dependencies = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).dependencies;
	assert.ok(dependencies["@rbxts/vide-charm"] !== undefined);
	assert.equal(dependencies["@rbxts/react-charm"], undefined);
	assert.match(fs.readFileSync(path.join(dir, "src/app/client/app.tsx"), "utf8"), /@rbxts\/vide-charm/);
	assert.match(fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8"), /@rbxts\/vide-charm/);
});

test("refuses Reflex with Vide", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const run = create(cwd, "my-game", "--no-git", "--ui", "vide", "--state", "reflex");
	assert.equal(run.status, 1);
	assert.match(JSON.parse(run.stdout).error, /Reflex.*Vide.*charm/);
	assert.ok(!fs.existsSync(path.join(cwd, "my-game")), "nothing is created");
});

test("lays out a multi-place game as Rogen prescribes", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const run = create(cwd, "my-game", "--no-git", "--places", "multi", "--data", "lapis");
	assert.equal(run.status, 0, run.stderr);
	const dir = path.join(cwd, "my-game");
	const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
	const exists = (file: string) => fs.existsSync(path.join(dir, file));

	for (const gone of ["src", "world", "tests", "default.rogen.json", "rbx-forge.config.ts", "jest.config.ts"]) {
		assert.ok(!exists(gone), `${gone} moved into the places`);
	}
	assert.ok(exists("projects/common/src/features/clicker/server/clicker-service.ts"));
	assert.ok(exists("projects/common/src/features/player-data/server/player-data-service.ts"), "add-ons are shared");
	assert.match(read("tsconfig.json"), /"include": \["projects\/common\/src"\]/);

	for (const place of ["lobby", "game"]) {
		const rogen = JSON.parse(read(`projects/${place}/default.rogen.json`));
		assert.equal(rogen.name, `my-game-${place}`);
		assert.deepEqual(rogen.sourcePaths, ["../common/src", "src"]);
		assert.equal(rogen.compiledPath, `../../out/${place}`);
		assert.equal(rogen.tree.ReplicatedStorage.rbxts_include.node_modules["@rbxts"].$path, "../../node_modules/@rbxts");
		assert.match(
			read(`projects/${place}/src/app/server/main.server.ts`),
			/import "\.\.\/\.\.\/\.\.\/\.\.\/common\/src\/features\/clicker\/server\/clicker-service";/,
		);
		assert.equal(JSON.parse(read(`projects/${place}/tsconfig.json`)).extends, `../../tsconfig.${place}.json`);
		const tsconfig = JSON.parse(read(`tsconfig.${place}.json`));
		assert.deepEqual(tsconfig.include, ["projects/common/src", `projects/${place}/src`]);
		assert.equal(tsconfig.compilerOptions.outDir, `out/${place}`);
		for (const file of ["world/default.project.json", "jest.config.ts"]) {
			assert.ok(exists(`projects/${place}/${file}`), `${place} has ${file}`);
		}
		assert.match(read(`projects/${place}/jest.config.ts`), new RegExp(`game\\.${place}\\.project\\.json`));
		assert.match(read(`projects/${place}/rbx-forge.config.ts`), /node \.\.\/\.\.\/scripts\/game-project\.ts/);
	}
	assert.match(read(".gitignore"), /\/projects\/\*\/build/);
	// Shared tests run once, in the game place.
	assert.ok(exists("projects/game/tests/e2e/clicker.luau"));
	assert.ok(!exists("projects/lobby/tests/e2e/clicker.luau"));
	assert.equal(JSON.parse(read("tsconfig.game.json")).exclude, undefined);
	assert.deepEqual(JSON.parse(read("tsconfig.lobby.json")).exclude, [
		"projects/common/src/**/*.spec.ts",
		"projects/common/src/**/*.spec.tsx",
	]);
	const agents = read("AGENTS.md");
	assert.match(agents, /## Where code goes\n\nThis game has several places/);
	assert.match(agents, /`projects\/common\/src\/features\/player-data\/server\/`/, "add-on notes name shared paths");
	assert.doesNotMatch(agents, /`(src\/features|world\/Workspace|tests\/e2e\/<feature>)/, "no single-place paths left");
	assert.match(read(".agents/skills/edit-world/SKILL.md"), /^# .+\n\n> This game has several places/m);
	assert.match(read("README.md"), /mise run dev lobby/);
	assert.deepEqual(JSON.parse(run.stdout).nextSteps.slice(-1), ["mise run dev lobby"]);
});

test("uploads assets with Asphalt", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const run = create(cwd, "my-game", "--no-git", "--assets", "asphalt");
	assert.equal(run.status, 0, run.stderr);
	const dir = path.join(cwd, "my-game");
	const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");

	// The game's developer names the creator; the template leaves the ID unset.
	assert.match(read("asphalt.toml"), /\[creator\]\ntype = "user"\nid = 0\n/);
	assert.match(read("asphalt.toml"), /output_path = "src\/shared"/);
	assert.ok(fs.existsSync(path.join(dir, "assets")));
	const mise = read("mise.toml");
	assert.match(mise, /\[tools\][^[]*"github:jackTabsCode\/asphalt" = "\d[^"]*"\n/, "the tool joins [tools]");
	assert.match(mise, /\n\[tasks\.assets\]\n/);
	// check and ci fail on assets that aren't uploaded yet.
	assert.equal(mise.match(/asphalt sync cloud --dry-run/g)?.length, 2);
	assert.match(read("biome.json"), /src\/shared\/assets\.d\.ts/, "Biome leaves Asphalt's code alone");
	assert.match(read("eslint.config.ts"), /src\/shared\/assets\.d\.ts/);
	assert.match(read(".env.example"), /^ASPHALT_API_KEY=$/m);
	assert.match(read(".gitignore"), /^\/\.asphalt-debug$/m);
	assert.match(read("AGENTS.md"), /## Assets/);
});

test("builds a release with Darklua", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const run = create(cwd, "my-game", "--no-git", "--release", "darklua");
	assert.equal(run.status, 0, run.stderr);
	const dir = path.join(cwd, "my-game");
	const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");

	assert.ok(fs.existsSync(path.join(dir, ".darklua.json")));
	for (const script of ["darklua.ts", "release-project.ts"])
		assert.ok(fs.existsSync(path.join(dir, "scripts", script)));
	const mise = read("mise.toml");
	assert.match(mise, /\[tools\][^[]*"github:seaofvoices\/darklua" = "\d[^"]*"/);
	assert.match(mise, /\n\[tasks\.release\]\n/);
	assert.match(read(".gitignore"), /^\/dist$/m);
	assert.match(read(".github/workflows/ci.yml"), /- run: mise run ci\n\s+- run: mise run release\n/);
	assert.match(read("AGENTS.md"), /## Release builds/);
});

test("Asphalt writes its code into the shared code of a multi-place game", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	const run = create(cwd, "my-game", "--no-git", "--places", "multi", "--assets", "asphalt", "--release", "darklua");
	assert.equal(run.status, 0, run.stderr);
	const read = (file: string) => fs.readFileSync(path.join(cwd, "my-game", file), "utf8");
	assert.match(read("asphalt.toml"), /output_path = "projects\/common\/src\/shared"/);
	assert.match(read("AGENTS.md"), /`projects\/common\/src\/shared\/assets\.luau`/);
});
