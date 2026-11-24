// jest-roblox runs every spec of this place in a real Roblox engine: `mise run test:engine`.
// It picks Roblox Studio when installed and Open Cloud otherwise; see AGENTS.md.
import fs from "node:fs";
import { defineConfig } from "@isentinel/jest-roblox";

// jest-roblox matches the folders it runs against the project's $path strings as written, which in
// this place's own project files start with ../. So it runs from the repo root, on the root's copy of
// the place's project (test.PLACE.project.json, which `mise run generate` writes), and gets the
// game's own folders that project mounts from the source folders (Rogen mounts each routed folder on
// its own), each a project whose specs sit beside its code. Wally's package folders are left out.
const root = new URL("../../", import.meta.url);
const project = "test.PLACE.project.json";
const mounts: string[] = [];
const collect = (node: unknown) => {
	if (typeof node !== "object" || node === null) return;
	for (const [key, value] of Object.entries(node)) {
		if (key !== "$path") collect(value);
		else {
			const mount = typeof value === "string" ? value : (value as { optional: string }).optional;
			const at = new URL(mount, root);
			// A folder Rogen splits, such as one whose shared specs this place leaves out, is mounted
			// file by file; those files are code, never specs, so they need no project of their own.
			if (/^projects\/[^/]+\/src\//.test(mount) && fs.existsSync(at) && fs.statSync(at).isDirectory()) {
				mounts.push(mount);
			}
		}
	}
};
const projectFile = new URL(project, root);
collect(fs.existsSync(projectFile) ? JSON.parse(fs.readFileSync(projectFile, "utf8")) : {});

export default defineConfig({
	rootDir: "../..",
	placeFile: "projects/PLACE/build/test.rbxl",
	// The whole place as the tests in ree see it, with the loadstring() Jest needs.
	rojoProject: project,
	// Jest from Wally's dev packages; the specs are Luau as written, so there's no source map to follow.
	jestPath: "ReplicatedStorage/DevPackages/Jest",
	sourceMap: false,
	luauRoots: mounts,
	formatters: ["agent"],
	test: {
		testMatch: ["**/*.spec.luau"],
	},
});
