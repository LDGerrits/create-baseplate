import fs from "node:fs";
import path from "node:path";
import { templateExtras } from "../../base/template.ts";
import type { Language } from "../add-ons/add-ons.ts";
import { makeMultiPlaceLuau } from "./multi-place-luau.ts";

/** The places a multi-place game starts with. */
export const PLACES = ["lobby", "game"];
/**
 * The place that runs the shared code's tests. Each place compiles the shared code, so its specs
 * and end-to-end tests would otherwise run once per place, for the same result.
 */
export const SHARED_TESTS_PLACE = "game";

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
export function makeMultiPlace(dir: string, name: string, language: Language, managed: Managed = "full") {
	if (language === "luau") makeMultiPlaceLuau(dir, name, managed);
	else makeMultiPlaceTypeScript(dir, name, managed);
}

/** Whether Rojo manages the whole place, world included, or only the code (see the managed question). */
export type Managed = "full" | "partial";

/** The managed question's answer in a game's add-on choices. */
export const managedOf = (chosen: Record<string, string>): Managed =>
	chosen.managed === "partial" ? "partial" : "full";

function makeMultiPlaceTypeScript(dir: string, name: string, managed: Managed) {
	const at = (...parts: string[]) => path.join(dir, ...parts);
	const read = (file: string) => fs.readFileSync(at(file), "utf8");
	// The template's text this relies on; fail rather than leave a half-converted game.
	const replaceIn = (text: string, from: string, to: string) => {
		if (!text.includes(from)) throw new Error(`places: the template no longer has: ${from}`);
		return text.replace(from, to);
	};
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
		// The template's end-to-end tests are the shared features'; the other places start with none.
		if (place === SHARED_TESTS_PLACE) fs.cpSync(at("tests"), path.join(placeDir, "tests"), { recursive: true });
		else {
			fs.mkdirSync(path.join(placeDir, "tests", "e2e"), { recursive: true });
			fs.writeFileSync(path.join(placeDir, "tests", "e2e", ".gitkeep"), "");
		}
		fs.writeFileSync(
			path.join(placeDir, "jest.config.ts"),
			fs
				.readFileSync(path.join(templateExtras("typescript"), "places", "multi", "jest.config.ts"), "utf8")
				.replaceAll("PLACE", place),
		);
		fs.writeFileSync(
			path.join(placeDir, "rbx-forge.config.ts"),
			read("rbx-forge.config.ts")
				.replaceAll("node scripts/", "node ../../scripts/")
				.replace(
					'import { defineConfig } from "rbx-forge";',
					'import { fileURLToPath } from "node:url";\nimport { defineConfig } from "rbx-forge";',
				)
				.replace(
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
				JSON.stringify(rogen.tree)
					.replaceAll('"node_modules/', '"../../node_modules/')
					.replace('{"optional":"include"}', '{"optional":"../../include"}'),
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

	// The sections that name the world have a variant for a game whose world lives in Studio.
	const extra = (file: string) =>
		fs.readFileSync(
			path.join(
				templateExtras("typescript"),
				"places",
				"multi",
				managed === "full" ? file : file.replace(/\.md$/, ".partial.md"),
			),
			"utf8",
		);
	let agents = replaceSection(read("AGENTS.md"), "Where code goes", extra("AGENTS.md"));
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

	let readme = replaceSection(read("README.md"), "Layout", extra("README-layout.md"));
	readme = replaceIn(readme, "mise run dev       #", "mise run dev lobby #");
	if (managed === "full") readme = replaceIn(readme, "mise run sync      #", "mise run sync lobby #");
	if (managed === "full") {
		readme = replaceIn(
			readme,
			"`mise run build`, open `build/game.rbxl` in Studio",
			"`mise run build`, open a place's `projects/<place>/build/game.rbxl` in Studio",
		);
	}
	fs.writeFileSync(at("README.md"), readme);

	// The UI skill names the UI root's single-place paths, as AGENTS.md's add-on notes do.
	const buildUi = at(".agents", "skills", "build-ui", "SKILL.md");
	if (fs.existsSync(buildUi)) {
		let skill = fs.readFileSync(buildUi, "utf8");
		for (const [from, to] of PATHS) skill = skill.replaceAll(from, to);
		fs.writeFileSync(buildUi, skill);
	}
	// Skills describe one place; say how their paths map.
	for (const skill of fs.readdirSync(at(".agents", "skills"))) {
		const file = at(".agents", "skills", skill, "SKILL.md");
		const text = fs.readFileSync(file, "utf8");
		fs.writeFileSync(file, text.replace(/^(# .+\n)/m, `$1\n${skillNote(managed)}\n`));
	}
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

/** Replaces the section under `## <heading>` with `section`, up to the next `## ` heading. */
export function replaceSection(text: string, heading: string, section: string) {
	const start = text.indexOf(`\n## ${heading}\n`) + 1;
	if (start === 0) throw new Error(`places: no "## ${heading}" section to replace`);
	const next = text.indexOf("\n## ", start);
	const end = next === -1 ? text.length : next + 1;
	return `${text.slice(0, start)}${section.trim()}\n${next === -1 ? "" : "\n"}${text.slice(end)}`;
}
