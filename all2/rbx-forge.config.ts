// rbx-forge runs the dev session: Rojo, Studio and syncback (`mise run dev`).
// Code and world are split. Rojo serves only the code (default.project.json); Studio opens a place
// built from world/ alone; syncback writes Studio's edits to world/ and never touches code.
import { defineConfig } from "rbx-forge";

export default defineConfig({
	projectType: "luau",
	rojoAlias: "rogen",
	rojoProjectPath: "default.project.json",
	buildOutputPath: "build/code.rbxl",
	// Save through forge's Studio plugin, without showing Studio's File menu or taking keyboard focus.
	studio: { saveMethod: "capture" },
	open: { projectPath: "world/default.project.json", buildOutputPath: "build/world.rbxl" },
	// On start, first sync back what was saved in Studio last time, so a rebuild of world/ keeps it.
	syncback: { inputPath: "build/world.rbxl", projectPath: "world/default.project.json", runOnStart: true },
	hooks: {
		syncback: {
			// The world's new instances show up in the types the editor and the check read.
			post: [
				"biome check --write world",
				"node scripts/game-project.ts",
				"rojo sourcemap game.project.json --include-non-scripts --output sourcemap.json",
			],
		},
	},
});
