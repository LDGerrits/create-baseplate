import { defineConfig } from "rbx-forge";

export default defineConfig({
	projectType: "luau",
	rojoAlias: "rogen",
	rojoProjectPath: "default.project.json",
	buildOutputPath: "build/code.rbxl",
	studio: { saveMethod: "capture" },
	open: { projectPath: "world/default.project.json", buildOutputPath: "build/world.rbxl" },
	// On start, first sync back what was saved in Studio last time, so a rebuild of world/ keeps it.
	syncback: { inputPath: "build/world.rbxl", projectPath: "world/default.project.json", runOnStart: true },
	hooks: {
		syncback: {
			post: [
				"biome check --write world",
				"node scripts/game-project.ts",
				"rojo sourcemap game.project.json --include-non-scripts --output sourcemap.json",
			],
		},
	},
});
