import fs from "node:fs";
import { defineConfig } from "@isentinel/jest-roblox";
import { pathsIn } from "../../scripts/rojo-project.ts";

// The place compiles to out/PLACE at the repo root, which jest-roblox can't find through the
// place's tsconfig. So it runs from the root, on the root's copy of the place's project
// (test.PLACE.project.json, which `mise run generate` writes), and gets the compiled folders that
// project mounts.
const project = "test.PLACE.project.json";
const compiledFolders = pathsIn(JSON.parse(fs.readFileSync(new URL(`../../${project}`, import.meta.url), "utf8"))).filter(
	(mount) => mount.startsWith("out/"),
);

export default defineConfig({
	rootDir: "../..",
	placeFile: "projects/PLACE/build/test.rbxl",
	rojoProject: project,
	luauRoots: compiledFolders,
	formatters: ["agent"],
});
