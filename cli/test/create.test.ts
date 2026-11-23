// Runs the built CLI (`pnpm build` first; turbo's test task does) without installing anything.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { stripVTControlCharacters } from "node:util";
import { validateAppName } from "../src/utils/appName.ts";
import { parseNameAndPath } from "../src/utils/parseNameAndPath.ts";

const CLI = path.resolve(import.meta.dirname, "../dist/index.js");
// Each test's folder, removed when the file's tests end: games add up to thousands of files.
const temps: string[] = [];
const tempDir = () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	temps.push(dir);
	return dir;
};
after(() => {
	for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
});
// CI has no git identity configured; a person's machine does.
const GIT_IDENTITY = {
	GIT_AUTHOR_NAME: "Test",
	GIT_AUTHOR_EMAIL: "test@example.com",
	GIT_COMMITTER_NAME: "Test",
	GIT_COMMITTER_EMAIL: "test@example.com",
};
const create = (cwd: string, ...args: string[]) =>
	spawnSync("node", [CLI, ...args, "--json", "--no-install"], {
		cwd,
		encoding: "utf8",
		env: { ...process.env, ...GIT_IDENTITY },
	});

test("creates a named project an agent can read", () => {
	const cwd = tempDir();
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

test("records which CLI and add-ons made the game", () => {
	const cwd = tempDir();
	const run = create(cwd, "coin-rush", "--no-git", "--state", "charm");
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
	const run = create(cwd, "my-game");
	assert.equal(run.status, 0, run.stderr);
	const log = spawnSync("git", ["log", "--oneline"], { cwd: path.join(cwd, "my-game"), encoding: "utf8" });
	assert.match(log.stdout, /Initial commit from create-baseplate/);
});

test("leaves the first commit until an install brings the add-ons' packages into the lockfile", () => {
	const cwd = tempDir();
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

	const run = create(cwd, "coin-rush");
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

test("names the game apart from its folder with --name", () => {
	const cwd = tempDir();
	const run = create(cwd, "Coin Rush", "--name", "coin-rush", "--no-git");
	assert.equal(run.status, 0, run.stderr);
	const result = JSON.parse(run.stdout) as { name: string; dir: string };
	assert.equal(result.name, "coin-rush");
	assert.equal(path.basename(result.dir), "Coin Rush");
	assert.equal(JSON.parse(fs.readFileSync(path.join(cwd, "Coin Rush/package.json"), "utf8")).name, "coin-rush");
});

// A person at a terminal: `script` gives the CLI one, sized so prompts draw. Skipped where `script` isn't there.
const hasScript = spawnSync("script", ["--version"]).status === 0;
test("rejects a bad name before asking anything", { skip: !hasScript }, () => {
	const cwd = tempDir();
	const run = spawnSync("script", ["-qec", `stty cols 120 rows 40; node ${CLI} "Bad Name"`, "/dev/null"], {
		cwd,
		encoding: "utf8",
		timeout: 10_000,
	});
	assert.equal(run.status, 1, "exits at once, without waiting for answers");
	assert.match(run.stdout, /can't name the game/);
	assert.doesNotMatch(run.stdout, /Which UI library/);
});

/** Types `input` into the CLI's first question at a terminal, and returns what it showed. */
const typeAnswer = (cwd: string, args: string, input: string) =>
	stripVTControlCharacters(
		spawnSync(
			"sh",
			// script ends when its input does, so the input waits for the prompt and stays open after.
			[
				"-c",
				`(sleep 0.5; printf '%s' "$ANSWER"; sleep 1.5) | script -qec "stty cols 120 rows 40; node ${CLI} ${args}" /dev/null`,
			],
			{ cwd, encoding: "utf8", timeout: 8_000, env: { ...process.env, ANSWER: input } },
		).stdout,
	);

test("takes a folder typed at the prompt that only --name can name", { skip: !hasScript }, () => {
	const cwd = tempDir();
	const shown = typeAnswer(cwd, "--name coin-rush", "Coin Rush\r");
	assert.doesNotMatch(shown, /can't name the game/);
	assert.match(shown, /Which language/, "goes on to the next question");
});

test("refuses a folder with files at the prompt, before the other questions", { skip: !hasScript }, () => {
	const cwd = tempDir();
	fs.mkdirSync(path.join(cwd, "taken"));
	fs.writeFileSync(path.join(cwd, "taken/file.txt"), "");
	// The question stays open for another answer, as it should; Ctrl+C then cancels, as a person would.
	const started = performance.now();
	const shown = typeAnswer(cwd, "", "taken\r\u0003");
	assert.ok(performance.now() - started < 4_000, "ends when cancelled, not at the time limit");
	assert.match(shown, /already has files in it/);
	assert.doesNotMatch(shown, /Which language/);
});

test("refuses flags that can't go together at the prompt, before asking a question with no choice", {
	skip: !hasScript,
}, () => {
	const cwd = tempDir();
	// With a folder: every language that takes the flags conflicts, so it refuses before asking anything.
	const withFolder = spawnSync(
		"script",
		["-qec", `stty cols 120 rows 40; node ${CLI} z/g --ui vide --state reflex --no-install --no-git`, "/dev/null"],
		{ cwd, encoding: "utf8", timeout: 10_000 },
	);
	assert.equal(withFolder.status, 1);
	assert.match(withFolder.stdout, /Reflex has no Vide binding/);
	assert.doesNotMatch(withFolder.stdout, /TypeError|Which language/);
	// Without one: it asks the name and the language, then refuses.
	const shown = stripVTControlCharacters(
		spawnSync(
			"sh",
			[
				"-c",
				`(sleep 0.5; printf 'g2\\r'; sleep 1; printf '\\r'; sleep 1.5) | script -qec "stty cols 120 rows 40; node ${CLI} --ui vide --state reflex --no-install --no-git" /dev/null`,
			],
			{ cwd, encoding: "utf8", timeout: 8_000 },
		).stdout,
	);
	assert.match(shown, /Reflex has no Vide binding/);
	assert.doesNotMatch(shown, /TypeError|One place, or several/);
});

test("refuses a folder that has files", () => {
	const cwd = tempDir();
	fs.mkdirSync(path.join(cwd, "taken"));
	fs.writeFileSync(path.join(cwd, "taken/file.txt"), "");
	const run = create(cwd, "taken", "--no-git");
	assert.equal(run.status, 1);
	assert.equal(JSON.parse(run.stdout).ok, false);
});

test("refuses a name npm wouldn't accept", () => {
	const cwd = tempDir();
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
	const cwd = tempDir();
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
	const cwd = tempDir();
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

test("creates a Luau game from the Luau template", () => {
	const cwd = tempDir();
	const run = create(cwd, "coin-rush", "--no-git", "--language", "luau");
	assert.equal(run.status, 0, run.stderr);
	const result = JSON.parse(run.stdout) as { language: string; addOns: Record<string, string> };
	assert.equal(result.language, "luau");
	assert.deepEqual(result.addOns, {
		ui: "react",
		places: "single",
		state: "none",
		data: "none",
		entities: "none",
		assets: "none",
		release: "none",
	});

	const dir = path.join(cwd, "coin-rush");
	const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
	const pkg = JSON.parse(read("package.json"));
	assert.equal(pkg.name, "coin-rush");
	assert.equal(pkg.baseplate.language, "luau");
	assert.equal(pkg.dependencies, undefined, "the game's packages are Wally's");
	assert.match(read("wally.toml"), /React = "jsdotlua\/react@=/);
	assert.ok(fs.existsSync(path.join(dir, "wally.lock")));
	assert.equal(JSON.parse(read("default.rogen.json")).name, "coin-rush");
	assert.match(read("src/App/Client/Game.storybook.luau"), /name = "coin-rush"/);
	assert.match(read("AGENTS.md"), /^# coin-rush\n\nA Roblox game in Luau/);
	assert.ok(fs.existsSync(path.join(dir, "src/Features/Clicker/Server/ClickerService.luau")));
	assert.ok(fs.existsSync(path.join(dir, ".claude/plugins/luau/.claude-plugin/plugin.json")));
	assert.ok(fs.lstatSync(path.join(dir, ".claude/skills")).isSymbolicLink());
	assert.ok(fs.existsSync(path.join(dir, ".gitignore")), ".gitignore restored from _gitignore");
	assert.ok(!fs.existsSync(path.join(dir, "_symlinks.json")));
	for (const typescript of ["tsconfig.json", "eslint.config.ts", "src/app", "src/features"]) {
		assert.ok(!fs.existsSync(path.join(dir, typescript)), `${typescript} is the TypeScript template's`);
	}
	for (const generated of ["node_modules", "Packages", "DevPackages", ".luau-lsp", "sourcemap.json"]) {
		assert.ok(!fs.existsSync(path.join(dir, generated)), `${generated} isn't copied`);
	}
});

test("applies Luau add-ons: Wally packages, files and the services they start", () => {
	const cwd = tempDir();
	const run = create(
		cwd,
		"my-game",
		"--no-git",
		"--language",
		"luau",
		"--state",
		"charm",
		"--data",
		"profilestore",
		"--entities",
		"jecs",
	);
	assert.equal(run.status, 0, run.stderr);
	const dir = path.join(cwd, "my-game");
	const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");

	const wally = read("wally.toml");
	assert.match(wally, /\[dependencies\][^[]*Charm = "littensy\/charm@=/);
	assert.match(wally, /\[dependencies\][^[]*Jecs = "ukendio\/jecs@=/);
	assert.match(wally, /\[server-dependencies\]\nProfileStore = "lm-loleris\/profilestore@=/);
	assert.equal(JSON.parse(read("package.json")).dependencies, undefined, "no npm packages for the game");

	const main = read("src/App/Server/Main.server.luau");
	assert.match(
		main,
		/require\(ServerScriptService\.Features\.Clicker\.ClickerService\),\n\trequire\(ServerScriptService\.Features\.PlayerData\.PlayerDataService\),\n\trequire\(ServerScriptService\.Features\.Spinner\.SpinnerService\),\n\}/,
	);
	assert.ok(fs.existsSync(path.join(dir, "src/Features/PlayerData/Server/PlayerDataService.spec.luau")));
	assert.ok(fs.existsSync(path.join(dir, "tests/e2e/spinner.luau")));
	assert.match(read("src/Features/Clicker/Client/ClickerController.luau"), /Charm\.signal/);

	const agents = read("AGENTS.md");
	assert.ok(agents.indexOf("## Player data") < agents.indexOf("<!-- rogen -->"), "add-on notes come before Rogen's");
	assert.match(agents, /## State/);
	assert.match(agents, /## Entities/);
});

test("swaps react-lua for Vide in a Luau game, with Charm's Vide binding", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--language", "luau", "--ui", "vide", "--state", "charm");
	assert.equal(run.status, 0, run.stderr);
	const dir = path.join(cwd, "my-game");
	const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
	const wally = read("wally.toml");
	assert.match(wally, /Vide = "centau\/vide@=/);
	assert.match(wally, /VideCharm = "littensy\/vide-charm@=/);
	for (const react of ["React =", "ReactRoblox =", "ReactRipple =", "ReactCharm ="]) {
		assert.doesNotMatch(wally, new RegExp(`^${react}`, "m"), `${react} is gone`);
	}
	assert.match(read("src/Features/Clicker/Client/ClickerButton.story.luau"), /CreateVideStory/);
	assert.match(read("src/App/Client/App.luau"), /VideCharm/);
	const agents = read("AGENTS.md");
	assert.match(agents, /## UI\n\nVide/);
	assert.doesNotMatch(agents, /react-lua|ReactRipple/, "AGENTS.md names no React package");
});

test("adds the Luau tools: Asphalt's Luau module and Darklua's release", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--language", "luau", "--assets", "asphalt", "--release", "darklua");
	assert.equal(run.status, 0, run.stderr);
	const dir = path.join(cwd, "my-game");
	const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
	const mise = read("mise.toml");
	assert.match(mise, /asphalt/);
	assert.match(mise, /darklua/);
	assert.match(mise, /\[tasks\.release\]/);
	assert.match(mise, /\[tasks\.assets\]/);
	assert.match(read("asphalt.toml"), /src\/Shared/);
	assert.ok(fs.existsSync(path.join(dir, ".darklua.json")));
	assert.match(read(".gitignore"), /^\/dist$/m);
	assert.match(read(".github/workflows/ci.yml"), /mise run release/);
	assert.match(mise, /\[tasks\.publish\][^[]*depends = \["release"\][^[]*publish\.ts build\/release\.rbxl/);
});

test("lays out a multi-place Luau game as Rogen prescribes for Luau", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--language", "luau", "--places", "multi", "--assets", "asphalt");
	assert.equal(run.status, 0, run.stderr);
	const dir = path.join(cwd, "my-game");
	const exists = (file: string) => fs.existsSync(path.join(dir, file));
	const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
	for (const place of ["lobby", "game"]) {
		const config = JSON.parse(read(`${place}.rogen.json`));
		assert.deepEqual(config.sourcePaths, ["projects/common/src", `projects/${place}/src`]);
		assert.ok(exists(`projects/${place}/src/App/Server/Main.server.luau`));
		assert.ok(exists(`projects/${place}/world/default.project.json`));
	}
	assert.ok(exists("projects/common/src/Features/Clicker/Server/ClickerService.luau"));
	assert.ok(exists("projects/game/tests/e2e/clicker.luau"), "the shared code's end-to-end tests run in one place");
	assert.ok(!exists("projects/lobby/tests/e2e/clicker.luau"));
	for (const gone of ["src", "world", "tests", "default.rogen.json"]) assert.ok(!exists(gone), `${gone} moved`);
	assert.ok(exists("wally.toml"), "the packages stay shared at the root");
	assert.match(read("asphalt.toml"), /output_path = "projects\/common\/src\/Shared"/);
	assert.match(read("AGENTS.md"), /projects\/common\/src/);
});

test("refuses a choice the language doesn't have", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--language", "luau", "--entities", "components");
	assert.equal(run.status, 1);
	const error = JSON.parse(run.stdout).error as string;
	assert.match(error, /--entities components isn't a Luau choice/);
	assert.match(error, /jecs, none/);
	assert.ok(!fs.existsSync(path.join(cwd, "my-game")), "creates nothing");
});

test("refuses a language that doesn't exist", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--language", "python");
	assert.equal(run.status, 1);
	assert.match(JSON.parse(run.stdout).error, /typescript, luau/);
});

test("refuses an add-on choice that doesn't exist", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--state", "redux");
	assert.equal(run.status, 1);
	assert.match(JSON.parse(run.stdout).error, /charm, reflex, none/);
});

test("swaps React for Vide", () => {
	const cwd = tempDir();
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
	const cwd = tempDir();
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
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--ui", "vide", "--state", "reflex");
	assert.equal(run.status, 1);
	assert.match(JSON.parse(run.stdout).error, /Reflex.*Vide.*charm/);
	assert.ok(!fs.existsSync(path.join(cwd, "my-game")), "nothing is created");
});

test("lays out a multi-place game in projects/", () => {
	const cwd = tempDir();
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
		assert.match(read(`projects/${place}/jest.config.ts`), new RegExp(`test\\.${place}\\.project\\.json`));
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
	const cwd = tempDir();
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
	const cwd = tempDir();
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
	assert.match(mise, /\[tasks\.publish\][^[]*depends = \["release"\][^[]*publish\.ts build\/release\.rbxl/);
	assert.match(read("AGENTS.md"), /## Release builds/);
});

test("Asphalt writes its code into the shared code of a multi-place game", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--places", "multi", "--assets", "asphalt", "--release", "darklua");
	assert.equal(run.status, 0, run.stderr);
	const read = (file: string) => fs.readFileSync(path.join(cwd, "my-game", file), "utf8");
	assert.match(read("asphalt.toml"), /output_path = "projects\/common\/src\/shared"/);
	assert.match(read("AGENTS.md"), /`projects\/common\/src\/shared\/assets\.luau`/);
});
