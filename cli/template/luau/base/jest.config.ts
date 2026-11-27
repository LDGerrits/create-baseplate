// jest-roblox picks Roblox Studio when installed and Open Cloud otherwise.
import fs from "node:fs";
import { defineConfig } from "@isentinel/jest-roblox";

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
	rojoProject: "test.project.json",
	jestPath: "ReplicatedStorage/DevPackages/Jest",
	sourceMap: false,
	luauRoots: mounts,
	formatters: ["agent"],
	test: {
		testMatch: ["**/*.spec.luau"],
	},
});
