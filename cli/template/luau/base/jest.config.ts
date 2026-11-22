// jest-roblox runs every spec in a real Roblox engine: `mise run test:engine`.
// It picks Roblox Studio when installed and Open Cloud otherwise; see AGENTS.md.
import fs from "node:fs";
import { defineConfig } from "@isentinel/jest-roblox";

// The game's own folders the project file mounts from src/ (Rogen mounts each routed folder on its
// own), each a project whose specs sit beside its code. Wally's package folders are left out.
const mounts: string[] = [];
const collect = (node: unknown) => {
	if (typeof node !== "object" || node === null) return;
	for (const [key, value] of Object.entries(node)) {
		if (key !== "$path") collect(value);
		else {
			const mount = typeof value === "string" ? value : (value as { optional: string }).optional;
			if (/^(\.\.\/)*(projects\/[^/]+\/)?src\//.test(mount) && fs.existsSync(mount)) mounts.push(mount);
		}
	}
};
collect(fs.existsSync("test.project.json") ? JSON.parse(fs.readFileSync("test.project.json", "utf8")) : {});

export default defineConfig({
	placeFile: "./build/test.rbxl",
	// The whole game, code and world, as the tests in ree see it, with the loadstring() Jest needs.
	rojoProject: "test.project.json",
	// Jest from Wally's dev packages; the specs are Luau as written, so there's no source map to follow.
	jestPath: "ReplicatedStorage/DevPackages/Jest",
	sourceMap: false,
	luauRoots: mounts,
	formatters: ["agent"],
	test: {
		testMatch: ["**/*.spec.luau"],
	},
});
