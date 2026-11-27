// jest-roblox picks Roblox Studio when installed and Open Cloud otherwise.
import fs from "node:fs";
import { defineConfig } from "@isentinel/jest-roblox";
import { pathsIn } from "./scripts/rojo-project.ts";

const project = fs.existsSync("test.project.json") ? JSON.parse(fs.readFileSync("test.project.json", "utf8")) : {};
const sourceFolders = pathsIn(project).filter(
	(mount) => /^(\.\.\/)*(projects\/[^/]+\/)?src\//.test(mount) && fs.existsSync(mount),
);

export default defineConfig({
	placeFile: "./build/test.rbxl",
	rojoProject: "test.project.json",
	jestPath: "ReplicatedStorage/DevPackages/Jest",
	sourceMap: false,
	luauRoots: sourceFolders,
	formatters: ["agent"],
	test: {
		testMatch: ["**/*.spec.luau"],
	},
});
