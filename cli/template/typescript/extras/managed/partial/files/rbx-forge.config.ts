// rbx-forge compiles on save (`mise run dev`) and, when an agent drives Studio (`forge up --studio`),
// opens a place made of the code alone. The user's own place, with its world, stays in Studio.
import { defineConfig } from "rbx-forge";

export default defineConfig({
	projectType: "rbxts",
	rbxts: { command: "sloptor", args: ["build", "--json"], project: "tsconfig.json" },
	rojoAlias: "rogen",
	rojoProjectPath: "default.project.json",
	buildOutputPath: "build/code.rbxl",
	hooks: { compile: { post: ["rogen write --quiet", "node scripts/game-project.ts"] } },
});
