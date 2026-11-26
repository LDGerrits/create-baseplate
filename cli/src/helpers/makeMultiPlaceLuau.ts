import fs from "node:fs";
import path from "node:path";
import { templateExtras } from "../consts.ts";
import { type Managed, PLACES, replaceSection, SHARED_TESTS_PLACE } from "./makeMultiPlace.ts";

/** Each place's builds and session state, and its world's project files when Rojo manages the world. */
const gitignore = (managed: Managed) => `
# Each place's builds and session state
/projects/*/build
/projects/*/.forge
/projects/*/.jest-roblox
${managed === "full" ? "!/projects/*/world/**/*.project.json\n" : ""}`;

/**
 * Turns the single-place Luau game in `dir` into places laid out as Rogen prescribes for Luau: each
 * place a `<place>.rogen.json` at the root, reading the shared code and its own
 * (`sourcePaths` `["projects/common/src", "projects/<place>/src"]`), so `rogen where` and
 * `rogen check` find the places of a shared file, and Rogen writes each place's code as
 * `<place>.project.json` at the root. Rogen's own example names the source folders src/common and
 * src/<place>; these follow the roblox-ts layout instead, projects/common/src and
 * projects/<place>/src, with the rest of a place (world/, tests/e2e/, its forge and jest-roblox
 * configs and generated files) in projects/<place>/, where the template's mise tasks run each
 * place's steps (scripts/each-place.ts). Wally's packages stay at the root, shared.
 *
 * Runs after the add-ons, so everything they put in src/ but app/ becomes shared code.
 */
export function makeMultiPlaceLuau(dir: string, name: string, managed: Managed) {
	const at = (...parts: string[]) => path.join(dir, ...parts);
	const read = (file: string) => fs.readFileSync(at(file), "utf8");
	// The template's text this relies on; fail rather than leave a half-converted game.
	const replaceIn = (text: string, from: string, to: string) => {
		if (!text.includes(from)) throw new Error(`places: the template no longer has: ${from}`);
		return text.replaceAll(from, to);
	};
	// The sections that name the world have a variant for a game whose world lives in Studio.
	const extra = (file: string) =>
		fs.readFileSync(
			path.join(
				templateExtras("luau"),
				"places",
				"multi",
				managed === "full" ? file : file.replace(/\.md$/, ".partial.md"),
			),
			"utf8",
		);
	const json = (value: unknown) => `${JSON.stringify(value, undefined, "\t")}\n`;

	const common = at("projects", "common", "src");
	fs.mkdirSync(common, { recursive: true });
	for (const entry of fs.readdirSync(at("src"))) {
		if (entry !== "app") fs.renameSync(at("src", entry), path.join(common, entry));
	}
	// A game that starts with no shared code still needs the folder Rogen reads.
	if (fs.readdirSync(common).length === 0) fs.writeFileSync(path.join(common, ".gitkeep"), "");

	const {
		name: _name,
		sourcePaths: _sourcePaths,
		globIgnorePaths,
		...rogen
	} = JSON.parse(read("default.rogen.json")) as Record<string, unknown>;
	for (const place of PLACES) {
		const placeDir = at("projects", place);
		fs.cpSync(at("src", "app"), path.join(placeDir, "src", "app"), { recursive: true });
		if (managed === "full") fs.cpSync(at("world"), path.join(placeDir, "world"), { recursive: true });
		// The template's end-to-end tests are the shared features'; the other places start with none.
		if (place === SHARED_TESTS_PLACE) fs.cpSync(at("tests"), path.join(placeDir, "tests"), { recursive: true });
		else {
			fs.mkdirSync(path.join(placeDir, "tests", "e2e"), { recursive: true });
			fs.writeFileSync(path.join(placeDir, "tests", "e2e", ".gitkeep"), "");
		}
		fs.writeFileSync(path.join(placeDir, "jest.config.ts"), extra("jest.config.ts").replaceAll("PLACE", place));
		fs.writeFileSync(
			path.join(placeDir, "rbx-forge.config.ts"),
			replaceIn(
				read("rbx-forge.config.ts").replaceAll("node scripts/", "node ../../scripts/"),
				'rojoProjectPath: "default.project.json"',
				`rojoProjectPath: "../../${place}.project.json"`,
			),
		);
		// The shared code's specs run in one place; the others leave them out, so each runs once.
		const ignored = [...((globIgnorePaths as string[] | undefined) ?? []), "projects/common/src/**/*.spec.luau"];
		fs.writeFileSync(
			at(`${place}.rogen.json`),
			json({
				name: `${name}-${place}`,
				sourcePaths: ["projects/common/src", `projects/${place}/src`],
				...(place === SHARED_TESTS_PLACE ? {} : { globIgnorePaths: ignored }),
				...rogen,
			}),
		);
	}

	for (const gone of [
		"src",
		"world",
		"tests",
		"default.rogen.json",
		"default.project.json",
		"game.project.json",
		"test.project.json",
		"sourcemap.json",
		"rbx-forge.config.ts",
		"jest.config.ts",
	]) {
		fs.rmSync(at(gone), { recursive: true, force: true });
	}

	fs.appendFileSync(at(".gitignore"), gitignore(managed));
	fs.appendFileSync(at(".styluaignore"), "/projects/*/build\n");
	fs.writeFileSync(
		at("scripts/check.ts"),
		replaceIn(read("scripts/check.ts"), '"selene src tests"', '"selene projects"'),
	);
	// Asphalt, from the root, writes the assets' IDs into the shared code.
	if (fs.existsSync(at("asphalt.toml"))) {
		fs.writeFileSync(
			at("asphalt.toml"),
			replaceIn(
				read("asphalt.toml"),
				'output_path = "src/game/assets/shared"',
				'output_path = "projects/common/src/game/assets/shared"',
			).replaceAll("src/game/assets/shared/Assets.luau", "projects/common/src/game/assets/shared/Assets.luau"),
		);
		fs.writeFileSync(
			at("mise.toml"),
			read("mise.toml").replaceAll(
				"src/game/assets/shared/Assets.luau",
				"projects/common/src/game/assets/shared/Assets.luau",
			),
		);
	}

	// Editors type one place at a time, from sourcemap.json at the root: the shared-tests place's,
	// with absolute paths, since its own sourcemap's paths are from its folder.
	const settings = Object.fromEntries(
		Object.entries(JSON.parse(read(".vscode/settings.json")) as Record<string, unknown>).map(([key, value]) =>
			key === "luau-lsp.sourcemap.rojoProjectFile"
				? [
						"luau-lsp.sourcemap.generatorCommand",
						`rojo sourcemap projects/${SHARED_TESTS_PLACE}/game.project.json --include-non-scripts --absolute --watch --output sourcemap.json`,
					]
				: [key, value],
		),
	);
	if (settings["luau-lsp.sourcemap.generatorCommand"] === undefined) {
		throw new Error("places: the template's .vscode/settings.json no longer has luau-lsp.sourcemap.rojoProjectFile");
	}
	fs.writeFileSync(at(".vscode", "settings.json"), json(settings));

	let agents = read("AGENTS.md");
	const fromWorld = managed === "full" ? " and `world/`" : "";
	agents = replaceIn(
		agents,
		`\`default.project.json\` (Rogen), \`game.project.json\`, \`test.project.json\` and \`sourcemap.json\` (\`mise run generate\`, from the code${fromWorld})`,
		`\`<place>.project.json\` at the root (Rogen, from \`<place>.rogen.json\`), each place's \`game.project.json\`, \`test.project.json\` and \`sourcemap.json\`, and \`test.<place>.project.json\` and \`sourcemap.json\` at the root (\`mise run generate\`, from the code${fromWorld})`,
	);
	agents = replaceIn(
		agents,
		"Add each to the list in `src/app/server/Main.server.luau` or `src/app/client/Start.luau`, or it never starts;",
		"Add each to the list in `src/app/server/Main.server.luau` or `src/app/client/Start.luau` of every place that uses it, or it never starts there;",
	);
	if (managed === "full") {
		agents = replaceIn(
			agents,
			"The map and lighting live in `world/` as files; luau-lsp types them from `sourcemap.json`",
			"Each place's map and lighting live in `world/` as files; luau-lsp types them from the place's `sourcemap.json`",
		);
	}
	agents = agents.replaceAll("builds the place", "builds every place");
	// Darklua's section names the folders its script processes, which the paths below would
	// rewrite to the shared code alone; and the spinner's end-to-end test is only in the game place.
	agents = agents
		.replace(
			"it processes `src/` and the packages",
			"it processes each place's code in `projects/<place>/src/`, the shared code's included, and the packages",
		)
		.replaceAll("`tests/e2e/spinner.luau`", `\`projects/${SHARED_TESTS_PLACE}/tests/e2e/spinner.luau\``);
	// Single-place paths, in the template's sections and the add-ons': a place's entry scripts,
	// world and tests are in its folder, and everything else in src/ is shared.
	agents = agents
		.replaceAll("`src/app/", "`projects/<place>/src/app/")
		.replaceAll("`src/", "`projects/common/src/")
		.replaceAll("→ src/", "→ projects/common/src/")
		.replaceAll("`tests/e2e/", "`projects/<place>/tests/e2e/")
		.replaceAll("`world/", "`projects/<place>/world/");
	// The section names the new layout's paths itself.
	agents = replaceSection(agents, "Where code goes", extra("AGENTS.md"));
	fs.writeFileSync(at("AGENTS.md"), agents);

	let readme = replaceSection(read("README.md"), "Layout", extra("README-layout.md"));
	readme = replaceIn(readme, "mise run dev       #", "mise run dev lobby #");
	if (managed === "full") readme = replaceIn(readme, "mise run sync      #", "mise run sync lobby #");
	readme = readme.replaceAll("builds the place", "builds every place");
	fs.writeFileSync(at("README.md"), readme);

	// Skills describe one place; say how their paths map.
	for (const skill of fs.readdirSync(at(".agents", "skills"))) {
		const file = at(".agents", "skills", skill, "SKILL.md");
		const text = fs.readFileSync(file, "utf8");
		fs.writeFileSync(file, text.replace(/^(# .+\n)/m, `$1\n${skillNote(managed)}\n`));
	}
}

const skillNote = (managed: Managed) =>
	managed === "full"
		? "> This game has several places (see `AGENTS.md`). Below, `world/`, `src/app/`, `tests/e2e/`, `build/`, `game.project.json` and `sourcemap.json` are each place's, under `projects/<place>/`, and the rest of `src/` is shared, in `projects/common/src/`. Run forge, ror and rojo from the place's folder, and name the place: `mise run dev <place>`, `mise run sync <place>`."
		: "> This game has several places (see `AGENTS.md`). Below, `src/app/`, `tests/e2e/`, `build/`, `game.project.json` and `sourcemap.json` are each place's, under `projects/<place>/`, and the rest of `src/` is shared, in `projects/common/src/`. Run forge, ror and rojo from the place's folder, and name the place: `mise run dev <place>`.";
