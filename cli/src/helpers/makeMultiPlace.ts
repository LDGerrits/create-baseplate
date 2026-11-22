import fs from "node:fs";
import path from "node:path";
import { templateExtras } from "../consts.ts";
import type { Language } from "../installers/index.ts";
import { makeMultiPlaceLuau } from "./makeMultiPlaceLuau.ts";

/** The places a multi-place game starts with. */
export const PLACES = ["lobby", "game"];
/**
 * The place that runs the shared code's tests. Each place compiles the shared code, so its specs
 * and end-to-end tests would otherwise run once per place, for the same result.
 */
export const SHARED_TESTS_PLACE = "game";

const GITIGNORE = `
# Each place's generated files
/projects/*/build
/projects/*/src/world.d.ts
/projects/*/.forge
/projects/*/.jest-roblox
!/projects/*/world/**/*.project.json
`;

/**
 * Turns the single-place game in `dir` into places laid out as Rogen prescribes. For roblox-ts:
 * the shared code in projects/common/src, and each place a folder in projects/ with its own
 * default.rogen.json (`sourcePaths` `["../common/src", "src"]`), tsconfig, entry scripts, world,
 * tests and forge config. Runs after the add-ons, so they land in the shared code.
 *
 * TypeScript 6 and later (Sloptor follows TypeScript 7) no longer infer rootDir: it must hold
 * every source, so a place that also compiles projects/common/src needs rootDir projects/.
 * Rogen's own example leaves rootDir unset, which only TypeScript 5 (rbxtsc) accepts. With
 * rootDir projects/, out/ can't sit in the place's folder (the compiler rejects project paths
 * into a folder inside rootDir), and Sloptor writes only inside its tsconfig's folder. So each
 * place compiles from tsconfig.<place>.json at the root to out/<place>, with the root's include/.
 */
export function makeMultiPlace(dir: string, name: string, language: Language) {
	if (language === "luau") makeMultiPlaceLuau(dir, name);
	else makeMultiPlaceTypeScript(dir, name);
}

function makeMultiPlaceTypeScript(dir: string, name: string) {
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
		fs.cpSync(at("world"), path.join(placeDir, "world"), { recursive: true });
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
	fs.appendFileSync(at(".gitignore"), GITIGNORE);
	// Asphalt, from the root, writes the assets' IDs into the shared code.
	if (fs.existsSync(at("asphalt.toml"))) {
		fs.writeFileSync(
			at("asphalt.toml"),
			replaceIn(read("asphalt.toml"), 'output_path = "src/shared"', 'output_path = "projects/common/src/shared"'),
		);
	}

	const extra = (file: string) =>
		fs.readFileSync(path.join(templateExtras("typescript"), "places", "multi", file), "utf8");
	let agents = replaceSection(read("AGENTS.md"), "Where code goes", extra("AGENTS.md"));
	agents = replaceIn(
		agents,
		"Import each in `src/app/server/main.server.ts` or `src/app/client/start.tsx`",
		"Import each in the entry script of every place that uses it, `projects/<place>/src/app/server/main.server.ts` or `projects/<place>/src/app/client/start.tsx`",
	);
	agents = replaceIn(agents, "`tests/e2e/<feature>.luau`", "`projects/<place>/tests/e2e/<feature>.luau`");
	agents = replaceIn(
		agents,
		"live in `world/` as files; code reaches them through the types in `src/world.d.ts`",
		"live in each place's `world/` as files; that place's code reaches them through the types in its `src/world.d.ts`",
	);
	agents = replaceIn(
		agents,
		"in `default.rogen.json`, like the existing scopes",
		"in each place's `default.rogen.json`, like the existing scopes",
	);
	// The add-ons' sections name single-place paths.
	for (const [from, to] of PATHS) agents = agents.replaceAll(from, to);
	fs.writeFileSync(at("AGENTS.md"), agents);

	let readme = replaceSection(read("README.md"), "Layout", extra("README-layout.md"));
	readme = replaceIn(readme, "mise run dev       #", "mise run dev lobby #");
	readme = replaceIn(readme, "mise run sync      #", "mise run sync lobby #");
	fs.writeFileSync(at("README.md"), readme);

	// Skills describe one place; say how their paths map.
	for (const skill of fs.readdirSync(at(".agents", "skills"))) {
		const file = at(".agents", "skills", skill, "SKILL.md");
		const text = fs.readFileSync(file, "utf8");
		fs.writeFileSync(file, text.replace(/^(# .+\n)/m, `$1\n${SKILL_NOTE}\n`));
	}
}

/** Single-place paths in add-on notes, and where they are in a multi-place game. */
const PATHS: [string, string][] = [
	["`src/features/", "`projects/common/src/features/"],
	["`src/network/", "`projects/common/src/network/"],
	["`src/store/", "`projects/common/src/store/"],
	["`src/shared/", "`projects/common/src/shared/"],
	["`world/Workspace/", "`projects/<place>/world/Workspace/"],
	["`tests/e2e/spinner.luau`", "`projects/<place>/tests/e2e/spinner.luau`"],
	["`src/app/client/start.tsx`", "each place's `src/app/client/start.tsx`"],
	["`src/app/server/main.server.ts`", "each place's `src/app/server/main.server.ts`"],
];

const SKILL_NOTE =
	"> This game has several places (see `AGENTS.md`). Below, `world/`, `src/app/`, `src/world.d.ts`, `tests/e2e/`, `build/` and `game.project.json` are each place's, under `projects/<place>/`, and shared features are in `projects/common/src/features/`. Run forge, ror and rojo from the place's folder, and name the place: `mise run dev <place>`, `mise run sync <place>`.";

/** Replaces the section under `## <heading>` with `section`, up to the next `## ` heading. */
function replaceSection(text: string, heading: string, section: string) {
	const start = text.indexOf(`\n## ${heading}\n`) + 1;
	if (start === 0) throw new Error(`places: no "## ${heading}" section to replace`);
	const next = text.indexOf("\n## ", start);
	const end = next === -1 ? text.length : next + 1;
	return `${text.slice(0, start)}${section.trim()}\n${next === -1 ? "" : "\n"}${text.slice(end)}`;
}
