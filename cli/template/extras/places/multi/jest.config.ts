// jest-roblox runs every spec of this place in a real Roblox engine: `mise run test:engine`.
// It picks Roblox Studio when installed and Open Cloud otherwise; see AGENTS.md.
import fs from "node:fs";
import { defineConfig } from "@isentinel/jest-roblox";

// The place compiles to out/PLACE at the repo root, which jest-roblox can't find through the
// place's tsconfig. So it runs from the root, on the root's copy of the place's project
// (test.PLACE.project.json, which `mise run generate` writes), and gets the compiled folders that
// project mounts.
const project = "test.PLACE.project.json";
const mounts: string[] = [];
const collect = (node: unknown) => {
	if (typeof node !== "object" || node === null) return;
	for (const [key, value] of Object.entries(node)) {
		if (key !== "$path") collect(value);
		else {
			const mount = typeof value === "string" ? value : (value as { optional?: string }).optional;
			if (mount?.startsWith("out/") === true) mounts.push(mount);
		}
	}
};
collect(JSON.parse(fs.readFileSync(new URL(`../../${project}`, import.meta.url), "utf8")));

export default defineConfig({
	rootDir: "../..",
	placeFile: "projects/PLACE/build/test.rbxl",
	// The whole place, code and world, as the tests in ree see it, with the loadstring() Jest needs.
	rojoProject: project,
	luauRoots: mounts,
	formatters: ["agent"],
});
