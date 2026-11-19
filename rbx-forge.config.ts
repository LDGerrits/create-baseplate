// rbx-forge runs the dev session: compiler, Rojo, Studio and syncback (`mise run dev`).
// Code and world are split. Rojo serves only the code (default.project.json); Studio opens a place
// built from world/ alone; syncback writes Studio's edits to world/ and never touches code.
import { defineConfig } from "rbx-forge";

export default defineConfig({
	projectType: "rbxts",
	rbxts: { command: "sloptor", args: ["build", "--json"], project: "tsconfig.json" },
	rojoAlias: "rogen",
	rojoProjectPath: "default.project.json",
	buildOutputPath: "build/code.rbxl",
	open: { projectPath: "world/default.project.json", buildOutputPath: "build/world.rbxl" },
	// On start, first sync back what was saved in Studio last time, so a rebuild of world/ keeps it.
	syncback: { inputPath: "build/world.rbxl", projectPath: "world/default.project.json", runOnStart: true },
	hooks: {
		compile: { post: ["rogen write --quiet", "node scripts/game-project.mjs", "node scripts/world-types.mjs"] },
		syncback: {
			post: ["biome check --write world", "node scripts/game-project.mjs", "node scripts/world-types.mjs"],
		},
	},
});
