// The add-on choices, and the shape of the game they make, through the built CLI.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { parseNameAndPath } from "../src/commands/create/parse-name-and-path.ts";
import { validateAppName } from "../src/domain/game/app-name.ts";
import { create, tempDir } from "./helpers.ts";

/** Why the created game's guard blocks an edit of `file`, or undefined when it lets it through. */
async function guardsEdit(dir: string, file: string): Promise<string | undefined> {
	const guard = (await import(pathToFileURL(path.join(dir, ".agents/hooks/guard.ts")).href)) as {
		guardReason: (payload: object, root: string, start: string) => string | undefined;
	};
	return guard.guardReason({ tool_name: "Edit", tool_input: { file_path: file } }, dir, dir);
}

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
	const run = create(
		cwd,
		"my-game",
		"--no-git",
		"--language",
		"typescript",
		"--state",
		"charm",
		"--data",
		"lapis",
		"--entities",
		"jecs",
	);
	assert.equal(run.status, 0, run.stderr);
	assert.deepEqual(JSON.parse(run.stdout).addOns, {
		ui: "react",
		places: "single",
		managed: "full",
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
	assert.ok(fs.existsSync(path.join(dir, "src/game/player-data/server/player-data-service.ts")));
	assert.ok(fs.existsSync(path.join(dir, "tests/e2e/spinner.luau")));
	assert.ok(!fs.existsSync(path.join(dir, "src/features/clicker")), "no example feature");

	const main = read("src/app/server/main.server.ts");
	assert.match(
		main,
		/import "\.\.\/\.\.\/game\/player-data\/server\/player-data-service";\n[\s\S]*Flamework\.ignite\(\)/,
	);
	assert.match(main, /features\/spinner\/server\/spinner-service/);

	const agents = read("AGENTS.md");
	assert.ok(agents.indexOf("## Player data") < agents.indexOf("<!-- rogen -->"), "add-on notes come before Rogen's");
	assert.match(agents, /## State/);
	assert.match(agents, /## Entities/);
});

test("takes Reflex and no other add-ons by default", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--language", "typescript");
	assert.deepEqual(JSON.parse(run.stdout).addOns, {
		ui: "react",
		places: "single",
		managed: "full",
		state: "reflex",
		data: "none",
		entities: "none",
		assets: "none",
		release: "none",
	});
	const mise = fs.readFileSync(path.join(cwd, "my-game/mise.toml"), "utf8");
	assert.doesNotMatch(mise, /asphalt|darklua/);
	assert.ok(!fs.existsSync(path.join(cwd, "my-game/src/game/player-data")));
});

test("creates a Luau game from the Luau template", () => {
	const cwd = tempDir();
	const run = create(cwd, "coin-rush", "--no-git", "--language", "luau");
	assert.equal(run.status, 0, run.stderr);
	const result = JSON.parse(run.stdout) as { language: string; addOns: Record<string, string> };
	assert.equal(result.language, "luau");
	assert.deepEqual(result.addOns, {
		ui: "vide",
		places: "single",
		managed: "full",
		state: "charm",
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
	assert.match(read("wally.toml"), /Vide = "centau\/vide@=/);
	assert.ok(fs.existsSync(path.join(dir, "wally.lock")));
	assert.equal(JSON.parse(read("default.rogen.json")).name, "coin-rush");
	assert.match(read("src/app/client/Game.storybook.luau"), /name = "coin-rush"/);
	assert.match(read("AGENTS.md"), /^# coin-rush\n\nA Roblox game in Luau/);
	assert.equal(read("src/app/server/Main.server.luau").match(/= \{\}$/m)?.length, 1, "no services start yet");
	assert.match(read("src/app/client/Start.luau"), /^local controllers: .* = \{\}$/m);
	for (const example of ["src/features", "src/app/client/App.luau", "tests/e2e/clicker.luau"]) {
		assert.ok(!fs.existsSync(path.join(dir, example)), `${example} isn't in the starting game`);
	}
	assert.ok(fs.existsSync(path.join(dir, ".claude/plugins/luau/.claude-plugin/plugin.json")));
	assert.ok(fs.lstatSync(path.join(dir, ".claude/skills")).isSymbolicLink());
	assert.ok(fs.existsSync(path.join(dir, ".gitignore")), ".gitignore restored from _gitignore");
	assert.ok(!fs.existsSync(path.join(dir, "_symlinks.json")));
	for (const typescript of ["tsconfig.json", "eslint.config.ts", "src/app/server/main.server.ts"]) {
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

	const main = read("src/app/server/Main.server.luau");
	assert.match(
		main,
		/local ServerScriptService = game:GetService\("ServerScriptService"\)\n\nlocal services: .* = \{\n\trequire\(ServerScriptService\.game\.playerdata\.PlayerDataService\),\n\trequire\(ServerScriptService\.features\.spinner\.SpinnerService\),\n\}/,
	);
	assert.ok(fs.existsSync(path.join(dir, "src/game/playerdata/server/PlayerDataService.spec.luau")));
	assert.ok(fs.existsSync(path.join(dir, "tests/e2e/spinner.luau")));

	const agents = read("AGENTS.md");
	assert.ok(agents.indexOf("## Player data") < agents.indexOf("<!-- rogen -->"), "add-on notes come before Rogen's");
	assert.match(agents, /## State/);
	assert.match(agents, /## Entities/);
});

test("swaps Vide for react-lua in a Luau game, with Charm's React binding", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--language", "luau", "--ui", "react", "--state", "charm");
	assert.equal(run.status, 0, run.stderr);
	const dir = path.join(cwd, "my-game");
	const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
	const wally = read("wally.toml");
	assert.match(wally, /React = "jsdotlua\/react@=/);
	assert.match(wally, /ReactRoblox = "jsdotlua\/react-roblox@=/);
	assert.match(wally, /ReactCharm = "littensy\/react-charm@=/);
	for (const vide of ["Vide =", "VideRipple =", "VideCharm ="]) {
		assert.doesNotMatch(wally, new RegExp(`^${vide}`, "m"), `${vide} is gone`);
	}
	assert.ok(!fs.existsSync(path.join(dir, "src/app/client/App.luau")), "no UI root to start with");
	const agents = read("AGENTS.md");
	assert.match(agents, /## UI\n\nReact/);
	assert.doesNotMatch(agents, /\bVide\b/, "AGENTS.md names no Vide package");
	assert.doesNotMatch(read(".agents/skills/build-ui/SKILL.md"), /\bVide\b/, "nor the build-ui skill");
	assert.doesNotMatch(read("selene.toml"), /mixed_table/, "Selene keeps its mixed-table lint");
});

test("adds the Luau tools: Asphalt's Luau module and Darklua's release", async () => {
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
	assert.match(read("asphalt.toml"), /src\/game\/assets\/shared/);
	assert.match((await guardsEdit(dir, "src/game/assets/shared/Assets.luau")) ?? "", /mise run assets/);
	assert.match((await guardsEdit(dir, "dist/app/server/Main.server.luau")) ?? "", /mise run release/);
	assert.ok(fs.existsSync(path.join(dir, ".darklua.json")));
	assert.match(read(".gitignore"), /^\/dist$/m);
	assert.doesNotMatch(read(".github/workflows/ci.yml"), /mise run release/);
	assert.match(mise, /\[tasks\."publish:build"\][^[]*depends = \["release"\]/);
	assert.match(
		mise,
		/\[tasks\.publish\]\ndescription = .*\ndepends = \["publish:build"\]\nrun = .*publish\.ts build\/release\.rbxl/,
	);
});

test("lays out a multi-place Luau game as Rogen prescribes for Luau", async () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--language", "luau", "--places", "multi", "--assets", "asphalt");
	assert.equal(run.status, 0, run.stderr);
	const dir = path.join(cwd, "my-game");
	const exists = (file: string) => fs.existsSync(path.join(dir, file));
	const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
	for (const place of ["lobby", "game"]) {
		const config = JSON.parse(read(`${place}.rogen.json`));
		assert.deepEqual(config.sourcePaths, ["projects/common/src", `projects/${place}/src`]);
		assert.ok(exists(`projects/${place}/src/app/server/Main.server.luau`));
		assert.ok(exists(`projects/${place}/world/default.project.json`));
	}
	assert.ok(exists("projects/common/src/.gitkeep"), "the shared code's folder stays, empty");
	assert.ok(!exists("projects/common/src/features"), "no feature to start with");
	assert.ok(exists("projects/game/tests/e2e/.gitkeep"));
	assert.ok(exists("projects/lobby/tests/e2e/.gitkeep"));
	for (const gone of ["src", "world", "tests", "default.rogen.json"]) assert.ok(!exists(gone), `${gone} moved`);
	assert.ok(exists("wally.toml"), "the packages stay shared at the root");
	assert.match(read("asphalt.toml"), /output_path = "projects\/common\/src\/game\/assets\/shared"/);
	assert.match((await guardsEdit(dir, "projects/common/src/game/assets/shared/Assets.luau")) ?? "", /mise run assets/);
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
	assert.match(JSON.parse(run.stdout).error, /luau, typescript/);
});

test("refuses an add-on choice that doesn't exist", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--language", "typescript", "--state", "redux");
	assert.equal(run.status, 1);
	assert.match(JSON.parse(run.stdout).error, /reflex, charm, none/);
});

test("swaps React for Vide", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--language", "typescript", "--ui", "vide");
	assert.equal(run.status, 0, run.stderr);

	const dir = path.join(cwd, "my-game");
	const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
	const pkg = JSON.parse(read("package.json")) as Record<string, Record<string, string>>;
	const all = { ...pkg.dependencies, ...pkg.devDependencies };
	assert.ok(all["@rbxts/vide"] !== undefined);
	for (const react of ["@rbxts/react", "@rbxts/react-roblox", "@rbxts/pretty-react-hooks", "eslint-plugin-react-x"]) {
		assert.equal(all[react], undefined, `${react} is gone`);
	}
	assert.match(read("tsconfig.json"), /"jsxFactory": "Vide\.jsx"/);
	assert.doesNotMatch(read("eslint.config.ts"), /react/);
	assert.ok(!fs.existsSync(path.join(dir, "src/app/client/app.tsx")), "no UI is mounted");
	const buildUi = read(".agents/skills/build-ui/SKILL.md");
	assert.match(buildUi, /CreateVideStory/, "the build-ui skill is Vide's");
	assert.doesNotMatch(buildUi, /\bReact\b|@rbxts\/react/, "the build-ui skill names no React package");

	const agents = read("AGENTS.md");
	assert.match(agents, /and Vide for the UI/);
	assert.match(agents, /## UI\n\nVide/);
	assert.doesNotMatch(agents, /\bReact\b|@rbxts\/react|[Rr]ipple/, "AGENTS.md names no React package");
	assert.doesNotMatch(read("README.md"), /React DevTools/);
});

test("takes Charm, with its Vide binding, by default with Vide", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--language", "typescript", "--ui", "vide");
	assert.equal(run.status, 0, run.stderr);
	assert.equal(JSON.parse(run.stdout).addOns.state, "charm");
	const dir = path.join(cwd, "my-game");
	const dependencies = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).dependencies;
	assert.ok(dependencies["@rbxts/vide-charm"] !== undefined);
	assert.equal(dependencies["@rbxts/react-charm"], undefined);
	assert.match(fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8"), /@rbxts\/vide-charm/);
});

test("refuses Reflex with Vide", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--language", "typescript", "--ui", "vide", "--state", "reflex");
	assert.equal(run.status, 1);
	assert.match(JSON.parse(run.stdout).error, /Reflex.*Vide.*charm/);
	assert.ok(!fs.existsSync(path.join(cwd, "my-game")), "nothing is created");
});

test("lays out a multi-place game in projects/", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--language", "typescript", "--places", "multi", "--data", "lapis");
	assert.equal(run.status, 0, run.stderr);
	const dir = path.join(cwd, "my-game");
	const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
	const exists = (file: string) => fs.existsSync(path.join(dir, file));

	for (const gone of ["src", "world", "tests", "default.rogen.json", "rbx-forge.config.ts", "jest.config.ts"]) {
		assert.ok(!exists(gone), `${gone} moved into the places`);
	}
	assert.ok(exists("projects/common/src/game/player-data/server/player-data-service.ts"), "add-ons are shared");
	assert.match(read("tsconfig.json"), /"include": \["projects\/common\/src"\]/);

	for (const place of ["lobby", "game"]) {
		const rogen = JSON.parse(read(`projects/${place}/default.rogen.json`));
		assert.equal(rogen.name, `my-game-${place}`);
		assert.deepEqual(rogen.sourcePaths, ["../common/src", "src"]);
		assert.equal(rogen.compiledPath, `../../out/${place}`);
		assert.equal(rogen.tree.ReplicatedStorage.rbxts_include.node_modules["@rbxts"].$path, "../../node_modules/@rbxts");
		assert.match(read(`projects/${place}/src/app/server/main.server.ts`), /Flamework\.ignite\(\);/);
		assert.match(read(`projects/${place}/src/app/client/main.client.ts`), /Flamework\.ignite\(\);/);
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
	// Shared tests run once, in the game place; each place keeps its own tests folder.
	assert.ok(exists("projects/game/tests/e2e/.gitkeep"));
	assert.ok(exists("projects/lobby/tests/e2e/.gitkeep"));
	assert.equal(JSON.parse(read("tsconfig.game.json")).exclude, undefined);
	assert.deepEqual(JSON.parse(read("tsconfig.lobby.json")).exclude, [
		"projects/common/src/**/*.spec.ts",
		"projects/common/src/**/*.spec.tsx",
	]);
	const agents = read("AGENTS.md");
	assert.match(agents, /## Where code goes\n\nThis game has several places/);
	assert.match(agents, /`projects\/common\/src\/game\/player-data\/server\/`/, "add-on notes name shared paths");
	assert.doesNotMatch(agents, /`(src\/features|world\/Workspace|tests\/e2e\/<feature>)/, "no single-place paths left");
	assert.match(read(".agents/skills/edit-world/SKILL.md"), /^# .+\n\n> This game has several places/m);
	assert.match(read("README.md"), /mise run dev lobby/);
	assert.deepEqual(JSON.parse(run.stdout).nextSteps.slice(-1), ["mise run dev lobby"]);
});

test("puts the rate limiter in the shared code of a multi-place game", () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--language", "typescript", "--places", "multi", "--state", "none");
	assert.equal(run.status, 0, run.stderr);
	assert.ok(fs.existsSync(path.join(cwd, "my-game/projects/common/src/platform/network/server/rate-limit.ts")));
	assert.ok(!fs.existsSync(path.join(cwd, "my-game/src")));
});

test("uploads assets with Asphalt", async () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--language", "typescript", "--assets", "asphalt");
	assert.equal(run.status, 0, run.stderr);
	const dir = path.join(cwd, "my-game");
	const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");

	// The game's developer names the creator; the template leaves the ID unset.
	assert.match(read("asphalt.toml"), /\[creator\]\ntype = "user"\nid = 0\n/);
	assert.match(read("asphalt.toml"), /output_path = "src\/game\/assets\/shared"/);
	for (const file of ["src/game/assets/shared/assets.luau", "src/game/assets/shared/assets.d.ts"]) {
		assert.match((await guardsEdit(dir, file)) ?? "", /mise run assets/, file);
	}
	assert.equal(await guardsEdit(dir, "src/game/assets/shared/icons.ts"), undefined);
	assert.ok(fs.existsSync(path.join(dir, "assets")));
	const mise = read("mise.toml");
	assert.match(mise, /\[tools\][^[]*"github:jackTabsCode\/asphalt" = "\d[^"]*"\n/, "the tool joins [tools]");
	assert.match(mise, /\n\[tasks\.assets\]\n/);
	// check and ci (one list of steps) fail on assets that aren't uploaded yet.
	assert.equal(read("scripts/check.ts").match(/node scripts\/assets\.ts --check/g)?.length, 1);
	assert.match(read("biome.json"), /src\/game\/assets\/shared\/assets\.d\.ts/, "Biome leaves Asphalt's code alone");
	assert.match(read("eslint.config.ts"), /src\/game\/assets\/shared\/assets\.d\.ts/);
	assert.match(read(".env.example"), /^ASPHALT_API_KEY=$/m);
	assert.match(read(".gitignore"), /^\/\.asphalt-debug$/m);
	assert.match(read("AGENTS.md"), /## Assets/);
});

test("builds a release with Darklua", async () => {
	const cwd = tempDir();
	const run = create(cwd, "my-game", "--no-git", "--language", "typescript", "--release", "darklua");
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
	assert.doesNotMatch(read(".github/workflows/ci.yml"), /mise run release/, "only publishing runs it");
	assert.match(mise, /\[tasks\."publish:build"\][^[]*depends = \["release"\]/);
	assert.match(
		mise,
		/\[tasks\.publish\]\ndescription = .*\ndepends = \["publish:build"\]\nrun = .*publish\.ts build\/release\.rbxl/,
	);
	assert.match(read("AGENTS.md"), /## Release builds/);
	for (const file of ["dist/app/server/main.server.luau", "release.project.json"]) {
		assert.match((await guardsEdit(dir, file)) ?? "", /mise run release/, file);
	}
});

test("refuses Darklua in a partially managed game", () => {
	const cwd = tempDir();
	const run = create(
		cwd,
		"my-game",
		"--no-git",
		"--language",
		"typescript",
		"--managed",
		"partial",
		"--release",
		"darklua",
	);
	assert.equal(run.status, 1);
	assert.match(JSON.parse(run.stdout).error, /publishes from Studio/);
});

test("Asphalt writes its code into the shared code of a multi-place game", () => {
	const cwd = tempDir();
	const run = create(
		cwd,
		"my-game",
		"--no-git",
		"--language",
		"typescript",
		"--places",
		"multi",
		"--assets",
		"asphalt",
		"--release",
		"darklua",
	);
	assert.equal(run.status, 0, run.stderr);
	const read = (file: string) => fs.readFileSync(path.join(cwd, "my-game", file), "utf8");
	assert.match(read("asphalt.toml"), /output_path = "projects\/common\/src\/game\/assets\/shared"/);
	assert.match(read("AGENTS.md"), /`projects\/common\/src\/game\/assets\/shared\/assets\.luau`/);
});
