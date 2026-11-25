// rbx-forge opens a place made of the code alone when an agent drives Studio (`forge up --studio`).
// The user's own place, with its world, stays in Studio; `mise run dev` serves it the code.
import { defineConfig } from "rbx-forge";

export default defineConfig({
	projectType: "luau",
	rojoAlias: "rogen",
	rojoProjectPath: "default.project.json",
	buildOutputPath: "build/code.rbxl",
});
