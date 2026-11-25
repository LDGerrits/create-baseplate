import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { cycleErrors, importEdges, layerZones, structureErrors } from "./layers.ts";

const ROOTS = ["src"];
const errorsFor = (...files: string[]) => structureErrors(files, ROOTS);

test("accepts files at the fixed depth in each layer", () => {
	assert.deepEqual(
		errorsFor(
			"src/app/server/main.server.ts",
			"src/app/client/ui.storybook.ts",
			"src/features/shop/server/shop-service.ts",
			"src/features/shop/shared/shop-network.ts",
			"src/game/player-data/server/player-data-service.ts",
			"src/platform/sound/client/sound-player.ts",
		),
		[],
	);
});

test("refuses a folder under src/ that is not a layer, and a loose file in src/", () => {
	assert.match(
		errorsFor("src/shared/assets.ts")[0] ?? "",
		/holds four folders, app\/, features\/, game\/ and platform\//,
	);
	assert.match(errorsFor("src/main.ts")[0] ?? "", /four folders/);
});

test("refuses a loose file directly in game/ or platform/, naming the next move", () => {
	assert.match(errorsFor("src/game/currency.ts")[0] ?? "", /no loose files directly in game\/.*<module>/);
	assert.match(errorsFor("src/platform/sound.ts")[0] ?? "", /no loose files directly in platform\//);
	assert.match(errorsFor("src/features/shop.ts")[0] ?? "", /a feature is a folder/);
});

test("refuses module names that say nothing, once per module", () => {
	for (const name of ["utils", "helpers", "common", "misc", "shared", "lib"]) {
		const errors = errorsFor(`src/game/${name}/server/a.ts`, `src/game/${name}/client/b.ts`);
		assert.equal(errors.length, 1, name);
		assert.match(errors[0] ?? "", /says nothing|side folder/);
	}
	assert.deepEqual(errorsFor("src/features/utils/server/a.ts"), []);
});

test("refuses files outside a side folder, at any depth", () => {
	assert.match(errorsFor("src/game/currency/currency.ts")[0] ?? "", /outside a side folder/);
	assert.match(errorsFor("src/features/shop/ui/button.ts")[0] ?? "", /outside a side folder/);
	assert.match(errorsFor("src/app/main.ts")[0] ?? "", /app\/ holds only side folders/);
});

test("refuses a side folder at the wrong depth", () => {
	assert.match(errorsFor("src/features/shop/ui/client/button.ts")[0] ?? "", /wrong depth/);
	assert.match(errorsFor("src/game/currency/server/helpers/client/a.ts")[0] ?? "", /wrong depth/);
	assert.match(errorsFor("src/app/server/x/client/a.ts")[0] ?? "", /wrong depth/);
});

test("in a multi-place game, checks each source root and keeps app/ to the places", () => {
	const roots = ["projects/common/src", "projects/lobby/src"];
	assert.deepEqual(
		structureErrors(
			["projects/common/src/game/currency/server/a.ts", "projects/lobby/src/app/server/main.server.ts"],
			roots,
		),
		[],
	);
	assert.match(
		structureErrors(["projects/common/src/app/server/main.server.ts"], roots)[0] ?? "",
		/belongs in projects\/<place>/,
	);
	assert.match(structureErrors(["projects/lobby/src/game/x.ts"], roots)[0] ?? "", /no loose files directly in game\//);
});

test("reports a cycle between two feature folders, whatever files carry it", () => {
	const errors = cycleErrors(
		[
			["src/features/shop/server/a.ts", "src/features/quests/server/b.ts"],
			["src/features/quests/client/c.ts", "src/features/shop/shared/d.ts"],
		],
		ROOTS,
	);
	assert.equal(errors.length, 1);
	assert.match(
		errors[0] ?? "",
		/^features\/quests and features\/shop import each other\. Merge them, move what both need into game\/<system>\//,
	);
	assert.match(errors[0] ?? "", /registry in game\/.*signal it exports/);
});

test("reports a longer cycle once, and ignores imports within a feature and acyclic ones", () => {
	const errors = cycleErrors(
		[
			["src/features/a/server/x.ts", "src/features/b/server/x.ts"],
			["src/features/b/server/x.ts", "src/features/c/server/x.ts"],
			["src/features/c/server/x.ts", "src/features/a/server/y.ts"],
			["src/features/a/server/x.ts", "src/features/a/server/y.ts"],
			["src/features/a/server/x.ts", "src/features/d/server/x.ts"],
			["src/features/a/server/x.ts", "src/game/g/server/x.ts"],
		],
		ROOTS,
	);
	assert.equal(errors.length, 1);
	assert.match(
		errors[0] ?? "",
		/features\/a, features\/b and features\/c import each other in a cycle \(features\/a -> features\/b -> features\/c -> features\/a\)/,
	);
	assert.deepEqual(cycleErrors([["src/features/a/server/x.ts", "src/features/b/server/x.ts"]], ROOTS), []);
});

test("finds imports by relative specifier, whatever their form", () => {
	const sources = new Map([
		[
			"src/features/a/server/x.ts",
			`import { B } from "../../b/server/b";
import type { C } from "../../c/shared/c";
import "../../d/server/d";
export * from "../../e/shared/e";
import("../../f/server/f");
import { Players } from "@rbxts/services";
// import "../../g/server/g";
`,
		],
		...["b/server/b", "c/shared/c", "d/server/d", "e/shared/e", "f/server/f", "g/server/g"].map(
			(name) => [`src/features/${name}.ts`, ""] as [string, string],
		),
	]);
	const imported = importEdges(sources, path.posix.join).map(([, to]) =>
		to.replace("src/features/", "").replace(".ts", ""),
	);
	assert.deepEqual(imported, ["b/server/b", "c/shared/c", "d/server/d", "e/shared/e", "f/server/f"]);
});

test("zones anchor each layer to its source root and stop at the places", () => {
	const zones = layerZones(["src"]);
	const down = zones.find((zone) => zone.target === "./src/game/**" && zone.from === "./src/features/**");
	assert.match(down?.message ?? "", /game\/ never knows a feature/);
	assert.ok(zones.find((zone) => zone.target === "./src/platform/**" && zone.from === "./src/game/**"));
	assert.ok(!zones.some((zone) => zone.target === "./src/app/**"));
	assert.ok(zones.every((zone) => zone.target.startsWith("./src/") && zone.from.startsWith("./src/")));

	const multi = layerZones(["projects/common/src", "projects/lobby/src"], ["lobby", "game"]);
	assert.ok(multi.some((zone) => zone.target === "./projects/common/**" && zone.from === "./projects/lobby/**"));
	assert.ok(multi.some((zone) => zone.target === "./projects/lobby/**" && zone.from === "./projects/game/**"));
	assert.ok(
		multi.some(
			(zone) => zone.target === "./projects/common/src/game/**" && zone.from === "./projects/lobby/src/features/**",
		),
	);
});
