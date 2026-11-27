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

/** Each place's generated files, and its world's project files when Rojo manages the world. */
const gitignore = (managed: Managed) => `
# Each place's generated files
/projects/*/build
${managed === "full" ? "/projects/*/src/world.d.ts\n" : ""}/projects/*/.forge
/projects/*/.jest-roblox
${managed === "full" ? "!/projects/*/world/**/*.project.json\n" : ""}`;

/**
 * Turns the single-place game in `dir` into several places. For roblox-ts: the shared code in
 * projects/common/src, and each place a folder in projects/ with its own default.rogen.json
 * (`sourcePaths` `["../common/src", "src"]`), tsconfig, entry scripts, world, tests and forge
 * config. Runs after the add-ons, so they land in the shared code.
 *
 * TypeScript 6 and later (Sloptor follows TypeScript 7) no longer infer rootDir: it must hold
 * every source, so a place that also compiles projects/common/src needs rootDir projects/. With
 * rootDir projects/, out/ can't sit in the place's folder (the compiler rejects project paths
 * into a folder inside rootDir), and Sloptor writes only inside its tsconfig's folder. So each
 * place compiles from tsconfig.<place>.json at the root to out/<place>, with the root's include/.
 */
export function makeMultiPlaceTypeScript(dir: string, name: string, choices: AddOnChoices) {
	const managed = managedOf(choices);
	const at = (...parts: string[]) => path.join(dir, ...parts);
	const read = (file: string) => fs.readFileSync(at(file), "utf8");
	// The template's text this relies on; fail rather than leave a half-converted game.
	const replaceIn = (text: string, from: string, to: string) => replaceExact(text, from, to, "places: the template");
	const extra = (file: string) => placesExtra("typescript", managed, file);
	const common = at("projects", "common", "src");
	fs.mkdirSync(common, { recursive: true });

	for (const entry of fs.readdirSync(at("src"))) {
		if (entry !== "app" && entry !== "world.d.ts") fs.renameSync(at("src", entry), path.join(common, entry));
	}

	// The template's shared code (its platform modules) moved in; without it, tsc would reject the
	// shared code's own type-check, a project with no input.
	if (fs.readdirSync(common).length === 0) throw new Error("places: the template has no shared code to move");

	const rogen = JSON.parse(read("default.rogen.json")) as Record<string, unknown>;
	for (const place of PLACES) {
		const placeDir = at("projects", place);
		fs.cpSync(at("src", "app"), path.join(placeDir, "src", "app"), { recursive: true });
		for (const file of fs.readdirSync(path.join(placeDir, "src", "app"), { recursive: true, encoding: "utf8" })) {
			const source = path.join(placeDir, "src", "app", file);
			if (!fs.statSync(source).isFile()) continue;
			// Imports of src/ from src/app/<side>/ now reach the shared code, four folders up.
			const code = fs.readFileSync(source, "utf8");
			fs.writeFileSync(
				source,
				code.replace(/^((?:import|export)\b[^"\n]*")\.\.\/\.\.\/(?!\.\.)/gm, "$1../../../../common/src/"),
			);
		}
		if (managed === "full") fs.cpSync(at("world"), path.join(placeDir, "world"), { recursive: true });
		copyPlaceTests(dir, placeDir, place);
		fs.writeFileSync(path.join(placeDir, "jest.config.ts"), extra("jest.config.ts").replaceAll("PLACE", place));
		let forge = read("rbx-forge.config.ts").replaceAll("node scripts/", "node ../../scripts/");
		forge = replaceIn(
			forge,
			'import { defineConfig } from "rbx-forge";',
			'import { fileURLToPath } from "node:url";\nimport { defineConfig } from "rbx-forge";',
		);
		fs.writeFileSync(
			path.join(placeDir, "rbx-forge.config.ts"),
			replaceIn(
				forge,
				'args: ["build", "--json"], project: "tsconfig.json"',
				// Sloptor reads --rojo from the tsconfig's folder, the root, so the path is absolute.
				`args: ["build", "--json", "--rojo", fileURLToPath(new URL("default.project.json", import.meta.url)), "--includePath", "../../include"], project: "../../tsconfig.${place}.json"`,
			),
		);
		const config = {
			...rogen,
			name: `${name}-${place}`,
			sourcePaths: ["../common/src", "src"],
			compiledPath: `../../out/${place}`,
			tree: JSON.parse(
				replaceIn(
					JSON.stringify(rogen.tree).replaceAll('"node_modules/', '"../../node_modules/'),
					'{"optional":"include"}',
					'{"optional":"../../include"}',
				),
			),
		};
		fs.writeFileSync(path.join(placeDir, "default.rogen.json"), `${JSON.stringify(config, undefined, "\t")}\n`);
		// Sloptor compiles the place from the root (it writes only inside its tsconfig's folder), and
		// the place's own tsconfig.json points editors and ESLint at the same settings.
		const json = (value: unknown) => `${JSON.stringify(value, undefined, "\t")}\n`;
		fs.writeFileSync(
			at(`tsconfig.${place}.json`),
			json({
				extends: "./tsconfig.json",
				compilerOptions: {
					rootDir: "projects",
					outDir: `out/${place}`,
					tsBuildInfoFile: `out/${place}/tsconfig.tsbuildinfo`,
					noEmit: false,
				},
				include: ["projects/common/src", `projects/${place}/src`],
				// The shared code's specs compile into one place only, so they run once.
				...(place === SHARED_TESTS_PLACE
					? {}
					: { exclude: ["projects/common/src/**/*.spec.ts", "projects/common/src/**/*.spec.tsx"] }),
			}),
		);
		fs.writeFileSync(path.join(placeDir, "tsconfig.json"), json({ extends: `../../tsconfig.${place}.json` }));
	}

	for (const gone of ["src", "world", "tests", "default.rogen.json", "rbx-forge.config.ts", "jest.config.ts"]) {
		fs.rmSync(at(gone), { recursive: true, force: true });
	}

	// The root tsconfig holds the shared settings, and covers the shared code for editors and ESLint.
	fs.writeFileSync(
		at("tsconfig.json"),
		replaceIn(
			replaceIn(read("tsconfig.json"), '"rootDir": "src",', '"rootDir": "projects/common/src",\n\t\t"noEmit": true,'),
			'"include": ["src"]',
			'"include": ["projects/common/src"]',
		),
	);
	fs.appendFileSync(at(".gitignore"), gitignore(managed));
	// Asphalt, from the root, writes the assets' IDs into the shared code.
	if (fs.existsSync(at("asphalt.toml"))) {
		fs.writeFileSync(
			at("asphalt.toml"),
			replaceIn(
				read("asphalt.toml"),
				'output_path = "src/game/assets/shared"',
				'output_path = "projects/common/src/game/assets/shared"',
			),
		);
	}

	let agents = replaceSection(read("AGENTS.md"), "Where code goes", extra("AGENTS.md"), "places: AGENTS.md");
	agents = replaceIn(agents, "`tests/e2e/<feature>.luau`", "`projects/<place>/tests/e2e/<feature>.luau`");
	if (managed === "full") {
		agents = replaceIn(
			agents,
			"live in `world/` as files; code reaches them through the types in `src/world.d.ts`",
			"live in each place's `world/` as files; that place's code reaches them through the types in its `src/world.d.ts`",
		);
	}
	agents = replaceIn(
		agents,
		"in `default.rogen.json`, like the existing scopes",
		"in each place's `default.rogen.json`, like the existing scopes",
	);
	// The add-ons' sections name single-place paths.
	for (const [from, to] of PATHS) agents = agents.replaceAll(from, to);
	if (managed === "full") agents = agents.replaceAll("under `world/`", "under a place's `world/`");
	fs.writeFileSync(at("AGENTS.md"), agents);

	fs.writeFileSync(at("README.md"), multiPlaceReadme(read("README.md"), extra("README-layout.md"), managed));

	// The UI skill names the UI root's single-place paths, as AGENTS.md's add-on notes do.
	const buildUi = at(".agents", "skills", "build-ui", "SKILL.md");
	if (fs.existsSync(buildUi)) {
		let skill = fs.readFileSync(buildUi, "utf8");
		for (const [from, to] of PATHS) skill = skill.replaceAll(from, to);
		fs.writeFileSync(buildUi, skill);
	}
	addSkillNotes(dir, skillNote(managed));
}

/** Single-place paths in add-on notes, and where they are in a multi-place game. */
const PATHS: [string, string][] = [
	["`src/features/", "`projects/common/src/features/"],
	["`src/game/", "`projects/common/src/game/"],
	["`src/platform/", "`projects/common/src/platform/"],
	["`world/Workspace/", "`projects/<place>/world/Workspace/"],
	["// src/app/client/ui-controller.tsx", "// projects/<place>/src/app/client/ui-controller.tsx"],
	["`tests/e2e/spinner.luau`", `\`projects/${SHARED_TESTS_PLACE}/tests/e2e/spinner.luau\``],
	["`src/app/client/app.tsx`", "each place's `src/app/client/app.tsx`"],
	["`src/app/client/main.client.ts`", "each place's `src/app/client/main.client.ts`"],
	["`src/app/server/main.server.ts`", "each place's `src/app/server/main.server.ts`"],
];

const skillNote = (managed: Managed) =>
	managed === "full"
		? "> This game has several places (see `AGENTS.md`). Below, `world/`, `src/app/`, `src/world.d.ts`, `tests/e2e/`, `build/` and `game.project.json` are each place's, under `projects/<place>/`, and shared features are in `projects/common/src/features/`. Run forge, ror and rojo from the place's folder, and name the place: `mise run dev <place>`, `mise run sync <place>`."
		: "> This game has several places (see `AGENTS.md`). Below, `src/app/`, `tests/e2e/`, `build/` and `game.project.json` are each place's, under `projects/<place>/`, and shared features are in `projects/common/src/features/`. Run forge, ror and rojo from the place's folder, and name the place: `mise run dev <place>`.";
