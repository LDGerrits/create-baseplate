import { defineConfig } from "rbx-forge";

export default defineConfig({
	projectType: "rbxts",
	rbxts: { command: "sloptor", args: ["build", "--json"], project: "tsconfig.json" },
	rojoAlias: "rogen",
	rojoProjectPath: "default.project.json",
	buildOutputPath: "build/code.rbxl",
	hooks: { compile: { post: ["rogen write --quiet", "node scripts/game-project.ts"] } },
});
