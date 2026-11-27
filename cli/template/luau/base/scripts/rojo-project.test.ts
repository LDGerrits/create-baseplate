import assert from "node:assert/strict";
import { test } from "node:test";
import { mapPaths, pathsIn, testProjectOf } from "./rojo-project.ts";

const project = {
	name: "game",
	globIgnorePaths: ["src/**/*.spec.luau"],
	tree: {
		$className: "DataModel",
		ReplicatedStorage: { $path: "src/shared", Packages: { $path: { optional: "Packages" } } },
		Workspace: { $properties: { Gravity: 100 }, Tags: { $attributes: { list: ["a", "b"] } } },
	},
};

test("pathsIn lists every $path, the optional form's too, in tree order", () => {
	assert.deepEqual(pathsIn(project), ["src/shared", "Packages"]);
});

test("mapPaths moves every $path and globIgnorePaths entry, and leaves the rest as it was", () => {
	assert.deepEqual(
		mapPaths(project, (p) => `world/${p}`),
		{
			name: "game",
			globIgnorePaths: ["world/src/**/*.spec.luau"],
			tree: {
				$className: "DataModel",
				ReplicatedStorage: { $path: "world/src/shared", Packages: { $path: { optional: "world/Packages" } } },
				Workspace: { $properties: { Gravity: 100 }, Tags: { $attributes: { list: ["a", "b"] } } },
			},
		},
	);
});

test("testProjectOf turns loadstring() on in ServerScriptService, keeping its other properties", () => {
	const game = { name: "game", tree: { ServerScriptService: { $path: "src/server", $properties: { A: 1 } } } };
	assert.deepEqual(testProjectOf(game), {
		name: "test",
		tree: { ServerScriptService: { $path: "src/server", $properties: { A: 1, LoadStringEnabled: true } } },
	});
	assert.deepEqual(testProjectOf({ name: "game", tree: {} }), {
		name: "test",
		tree: { ServerScriptService: { $className: "ServerScriptService", $properties: { LoadStringEnabled: true } } },
	});
});
