import fs from "node:fs";
import path from "node:path";
import { TEMPLATE_EXTRAS } from "../consts.ts";

/** The places a multi-place game starts with. */
export const PLACES = ["lobby", "game"];

const GITIGNORE = `
# Each place's generated files
/projects/*/build
/projects/*/src/world.d.ts
/projects/*/.forge
/projects/*/.rotor
/projects/*/flamework.build
/projects/*/.jest-roblox
!/projects/*/world/**/*.project.json
`;

/**
 * Turns the single-place game in `dir` into places laid out as Rogen prescribes for roblox-ts:
 * the shared code in projects/common/src, and each place a folder in projects/ with its own
 * default.rogen.json (`sourcePaths` `["../common/src", "src"]`), tsconfig, entry scripts, world,
 * tests and forge config. Runs after the add-ons, so they land in the shared code.
 *
 * Each place compiles to out/<place> at the root, with the root's include/, from its own
 * tsconfig.<place>.json at the root: roblox-ts rejects project paths into a folder inside its
 * rootDir (projects/ for a place, so not projects/<place>/out), and Sloptor writes only inside
 * its tsconfig's folder.
 */
export function makeMultiPlace(dir: string, name: string) {
	const at = (...parts: string[]) => path.join(dir, ...parts);
	const read = (file: string) => fs.readFileSync(at(file), "utf8");
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
			// From projects/<place>/src/app/<side>/, the shared code is four folders up.
			fs.writeFileSync(source, fs.readFileSync(source, "utf8").replaceAll('"../../', '"../../../../common/src/'));
		}
		for (const folder of ["world", "tests"]) fs.cpSync(at(folder), path.join(placeDir, folder), { recursive: true });
		for (const file of ["rotor.toml", "jest.config.ts"]) fs.copyFileSync(at(file), path.join(placeDir, file));
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
		read("tsconfig.json")
			.replace('"rootDir": "src",', '"rootDir": "projects/common/src",\n\t\t"noEmit": true,')
			.replace('"include": ["src"]', '"include": ["projects/common/src"]'),
	);
	fs.appendFileSync(at(".gitignore"), GITIGNORE);

	const agents = read("AGENTS.md");
	const start = agents.indexOf("\n## Where code goes\n") + 1;
	const end = agents.indexOf("\n## ", start) + 1;
	const section = fs.readFileSync(path.join(TEMPLATE_EXTRAS, "places", "multi", "AGENTS.md"), "utf8");
	fs.writeFileSync(at("AGENTS.md"), `${agents.slice(0, start)}${section.trim()}\n\n${agents.slice(end)}`);
}
