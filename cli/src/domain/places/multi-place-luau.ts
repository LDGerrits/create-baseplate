import fs from "node:fs";
import path from "node:path";
import { replaceExact, replaceSection } from "../../base/text-edit.ts";
import { type AddOnChoices, type Managed, managedOf } from "../add-ons/questions.ts";
import {
	addSkillNotes,
	copyPlaceTests,
	multiPlaceReadme,
	PLACES,
	placesExtra,
	SHARED_TESTS_PLACE,
} from "./place-steps.ts";

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
export function makeMultiPlaceLuau(dir: string, name: string, choices: AddOnChoices) {
	const managed = managedOf(choices);
	const at = (...parts: string[]) => path.join(dir, ...parts);
	const read = (file: string) => fs.readFileSync(at(file), "utf8");
	const replaceIn = (text: string, from: string, to: string) => replaceExact(text, from, to, "places: the template");
	const extra = (file: string) => placesExtra("luau", managed, file);
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
		copyPlaceTests(dir, placeDir, place);
		fs.writeFileSync(path.join(placeDir, "jest.config.ts"), extra("jest.config.ts").replaceAll("PLACE", place));
		fs.writeFileSync(
			path.join(placeDir, "rbx-forge.config.ts"),
			replaceIn(
				read("rbx-forge.config.ts").replaceAll("node scripts/", "node ../../scripts/"),
				'rojoProjectPath: "default.project.json"',
				`rojoProjectPath: "../../${place}.project.json"`,
			),
		);
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
	if (managed === "full") {
		agents = replaceIn(
			agents,
			"The map and lighting live in `world/` as files; luau-lsp types them from `sourcemap.json`",
			"Each place's map and lighting live in `world/` as files; luau-lsp types them from the place's `sourcemap.json`",
		);
	}
	agents = replaceIn(agents, "builds the place", "builds every place");
	if (choices.release === "darklua") {
		agents = replaceIn(
			agents,
			"it processes `src/` and the packages",
			"it processes each place's code in `projects/<place>/src/`, the shared code's included, and the packages",
		);
	}
	agents = agents.replaceAll("`tests/e2e/spinner.luau`", `\`projects/${SHARED_TESTS_PLACE}/tests/e2e/spinner.luau\``);
	agents = agents
		.replaceAll("`src/app/", "`projects/<place>/src/app/")
		.replaceAll("`src/", "`projects/common/src/")
		.replaceAll("→ src/", "→ projects/common/src/")
		.replaceAll("`tests/e2e/", "`projects/<place>/tests/e2e/")
		.replaceAll("`world/", "`projects/<place>/world/");
	agents = replaceSection(agents, "Where code goes", extra("AGENTS.md"), "places: AGENTS.md");
	fs.writeFileSync(at("AGENTS.md"), agents);

	const readme = multiPlaceReadme(read("README.md"), extra("README-layout.md"), managed);
	fs.writeFileSync(at("README.md"), replaceIn(readme, "builds the place", "builds every place"));

	addSkillNotes(dir, skillNote(managed));
}

const skillNote = (managed: Managed) =>
	managed === "full"
		? "> This game has several places (see `AGENTS.md`). Below, `world/`, `src/app/`, `tests/e2e/`, `build/`, `game.project.json` and `sourcemap.json` are each place's, under `projects/<place>/`, and the rest of `src/` is shared, in `projects/common/src/`. Run forge, ror and rojo from the place's folder, and name the place: `mise run dev <place>`, `mise run sync <place>`."
		: "> This game has several places (see `AGENTS.md`). Below, `src/app/`, `tests/e2e/`, `build/`, `game.project.json` and `sourcemap.json` are each place's, under `projects/<place>/`, and the rest of `src/` is shared, in `projects/common/src/`. Run forge, ror and rojo from the place's folder, and name the place: `mise run dev <place>`.";
