import { defineConfig } from "rbx-forge";

export default defineConfig({
	projectType: "rbxts",
	rbxts: { command: "sloptor", args: ["build", "--json"], project: "tsconfig.json" },
	rojoAlias: "rogen",
	rojoProjectPath: "default.project.json",
	buildOutputPath: "build/code.rbxl",
	// Save through forge's Studio plugin, without showing Studio's File menu or taking keyboard focus.
	studio: { saveMethod: "capture" },
	open: { projectPath: "world/default.project.json", buildOutputPath: "build/world.rbxl" },
	syncback: { inputPath: "build/world.rbxl", projectPath: "world/default.project.json", runOnStart: true },
	hooks: {
		compile: { post: ["rogen write --quiet", "node scripts/game-project.ts", "node scripts/world-types.ts"] },
		syncback: {
			post: ["biome check --write world", "node scripts/game-project.ts", "node scripts/world-types.ts"],
		},
	},
});
