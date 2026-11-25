import assert from "node:assert/strict";
import { test } from "node:test";
import { cycleErrors, layerErrors, requireEdges, type SourcemapNode, structureErrors } from "./layers.ts";

const ROOTS = ["src"];
const errorsFor = (...files: string[]) => structureErrors(files, ROOTS);

test("accepts files at the fixed depth in each layer", () => {
	assert.deepEqual(
		errorsFor(
			"src/app/server/main.server.luau",
			"src/app/client/ui.storybook.luau",
			"src/features/shop/server/ShopService.luau",
			"src/features/shop/shared/ShopNetwork.luau",
			"src/game/playerdata/server/PlayerDataService.luau",
			"src/platform/sound/client/SoundPlayer.luau",
		),
		[],
	);
});

test("refuses a folder under src/ that is not a layer, and a loose file in src/", () => {
	assert.match(
		errorsFor("src/shared/assets.luau")[0] ?? "",
		/holds four folders, app\/, features\/, game\/ and platform\//,
	);
	assert.match(errorsFor("src/main.luau")[0] ?? "", /four folders/);
});

test("refuses a loose file directly in game/ or platform/, naming the next move", () => {
	assert.match(errorsFor("src/game/currency.luau")[0] ?? "", /no loose files directly in game\/.*<module>/);
	assert.match(errorsFor("src/platform/sound.luau")[0] ?? "", /no loose files directly in platform\//);
	assert.match(errorsFor("src/features/shop.luau")[0] ?? "", /a feature is a folder/);
});

test("refuses module names that say nothing, once per module", () => {
	for (const name of ["utils", "helpers", "common", "misc", "shared", "lib"]) {
		const errors = errorsFor(`src/game/${name}/server/a.ts`, `src/game/${name}/client/b.ts`);
		assert.equal(errors.length, 1, name);
		assert.match(errors[0] ?? "", /says nothing|side folder/);
	}
	assert.deepEqual(errorsFor("src/features/utils/server/a.luau"), []);
});

test("refuses files outside a side folder, at any depth", () => {
	assert.match(errorsFor("src/game/currency/currency.luau")[0] ?? "", /outside a side folder/);
	assert.match(errorsFor("src/features/shop/ui/button.luau")[0] ?? "", /outside a side folder/);
	assert.match(errorsFor("src/app/main.luau")[0] ?? "", /app\/ holds only side folders/);
});

test("refuses a side folder at the wrong depth", () => {
	assert.match(errorsFor("src/features/shop/ui/client/button.luau")[0] ?? "", /wrong depth/);
	assert.match(errorsFor("src/game/currency/server/helpers/client/a.luau")[0] ?? "", /wrong depth/);
	assert.match(errorsFor("src/app/server/x/client/a.luau")[0] ?? "", /wrong depth/);
});

test("in a multi-place game, checks each source root and keeps app/ to the places", () => {
	const roots = ["projects/common/src", "projects/lobby/src"];
	assert.deepEqual(
		structureErrors(
			["projects/common/src/game/currency/server/a.luau", "projects/lobby/src/app/server/main.server.luau"],
			roots,
		),
		[],
	);
	assert.match(
		structureErrors(["projects/common/src/app/server/main.server.luau"], roots)[0] ?? "",
		/belongs in projects\/<place>/,
	);
	assert.match(
		structureErrors(["projects/lobby/src/game/x.luau"], roots)[0] ?? "",
		/no loose files directly in game\//,
	);
});

test("reports a cycle between two feature folders, whatever files carry it", () => {
	const errors = cycleErrors(
		[
			["src/features/shop/server/a.luau", "src/features/quests/server/b.luau"],
			["src/features/quests/client/c.luau", "src/features/shop/shared/d.luau"],
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
			["src/features/a/server/x.luau", "src/features/b/server/x.luau"],
			["src/features/b/server/x.luau", "src/features/c/server/x.luau"],
			["src/features/c/server/x.luau", "src/features/a/server/y.luau"],
			["src/features/a/server/x.luau", "src/features/a/server/y.luau"],
			["src/features/a/server/x.luau", "src/features/d/server/x.luau"],
			["src/features/a/server/x.luau", "src/game/g/server/x.luau"],
		],
		ROOTS,
	);
	assert.equal(errors.length, 1);
	assert.match(
		errors[0] ?? "",
		/features\/a, features\/b and features\/c import each other in a cycle \(features\/a -> features\/b -> features\/c -> features\/a\)/,
	);
	assert.deepEqual(cycleErrors([["src/features/a/server/x.luau", "src/features/b/server/x.luau"]], ROOTS), []);
});

test("refuses a folder name that isn't lowercase letters and digits", () => {
	assert.match(errorsFor("src/game/playerData/server/PlayerDataService.luau")[0] ?? "", /lowercase letters and digits/);
	assert.match(errorsFor("src/features/daily-reward/server/X.luau")[0] ?? "", /lowercase letters and digits/);
	assert.deepEqual(errorsFor("src/game/playerdata/server/PlayerDataService.luau"), []);
});

/** A sourcemap from instance paths and the files that are their modules; the folders between have none. */
function sourcemap(modules: Record<string, string>): SourcemapNode {
	const root: SourcemapNode = { name: "game", className: "DataModel", children: [] };
	for (const [instance, file] of Object.entries(modules)) {
		let node = root;
		const names = instance.split(".");
		for (const [at, name] of names.entries()) {
			let child = node.children?.find((candidate) => candidate.name === name);
			if (child === undefined) {
				child = { name, className: "Folder", children: [] };
				node.children?.push(child);
			}
			node = child;
			if (at === names.length - 1) Object.assign(node, { className: "ModuleScript", filePaths: [file] });
		}
	}
	return root;
}

const MAP = sourcemap({
	"ServerScriptService.features.shop.ShopService": "src/features/shop/server/ShopService.luau",
	"ServerScriptService.features.quests.QuestService": "src/features/quests/server/QuestService.luau",
	"ServerScriptService.game.bank.Bank": "src/game/bank/server/Bank.luau",
	"ServerScriptService.platform.sound.Sound": "src/platform/sound/server/Sound.luau",
	"ReplicatedStorage.Shared.game.currency.Currency": "src/game/currency/shared/Currency.luau",
	"ReplicatedStorage.Shared.platform.net.Net": "src/platform/net/shared/Net.luau",
	"StarterPlayer.StarterPlayerScripts.app.Start": "src/app/client/Start.luau",
	"StarterPlayer.StarterPlayerScripts.features.shop.ShopController": "src/features/shop/client/ShopController.luau",
	"StarterPlayer.StarterPlayerScripts.game.hud.Hud": "src/game/hud/client/Hud.luau",
});
const FILES = new Set(JSON.stringify(MAP).match(/src\/[^"]+\.luau/g));

function edgesOf(sources: Record<string, string>) {
	return requireEdges(MAP, ".", FILES, (file) => sources[file] ?? "");
}

test("follows instance paths, locals and script.Parent chains through the sourcemap", () => {
	const edges = edgesOf({
		"src/features/shop/server/ShopService.luau": `local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Bank = require(ServerScriptService.game.bank.Bank)
local Currency = require(Shared.game.currency.Currency)
local Quests = require(ServerScriptService:WaitForChild("features"):WaitForChild("quests").QuestService)
-- local Sound = require(ServerScriptService.platform.sound.Sound)
local Net = require(game:GetService("ReplicatedStorage").Shared["platform"].net.Net)
local Jest = require(ReplicatedStorage.Packages.Jest)
`,
		"src/app/client/Start.luau": `local shop = require(script.Parent.Parent.features.shop.ShopController)`,
	});
	assert.deepEqual(edges, [
		["src/features/shop/server/ShopService.luau", "src/game/bank/server/Bank.luau"],
		["src/features/shop/server/ShopService.luau", "src/game/currency/shared/Currency.luau"],
		["src/features/shop/server/ShopService.luau", "src/features/quests/server/QuestService.luau"],
		["src/features/shop/server/ShopService.luau", "src/platform/net/shared/Net.luau"],
		["src/app/client/Start.luau", "src/features/shop/client/ShopController.luau"],
	]);
});

test("refuses a layer that requires one above it, with the next move", () => {
	const roots = ["src"];
	const errors = layerErrors(
		edgesOf({
			"src/game/bank/server/Bank.luau": `local ServerScriptService = game:GetService("ServerScriptService")
local Shop = require(ServerScriptService.features.shop.ShopService)`,
			"src/platform/sound/server/Sound.luau": `local Bank = require(game:GetService("ServerScriptService").game.bank.Bank)`,
			"src/features/shop/client/ShopController.luau": `local Start = require(script.Parent.Parent.Parent.app.Start)`,
		}),
		roots,
	);
	assert.equal(errors.length, 3);
	assert.match(
		errors[0] ?? "",
		/^game\/bank requires features\/shop\. game\/ never knows a feature: have the feature register with game\/bank, or move the code into the feature\./,
	);
	assert.match(errors[1] ?? "", /^platform\/sound requires game\/bank\. platform\/ is game-agnostic/);
	assert.match(errors[2] ?? "", /^features\/shop requires app\//);
});

test("allows requires that go down, and between modules of a layer", () => {
	const errors = layerErrors(
		edgesOf({
			"src/app/client/Start.luau": `local Hud = require(script.Parent.Parent.game.hud.Hud)`,
			"src/features/shop/server/ShopService.luau": `local Bank = require(game:GetService("ServerScriptService").game.bank.Bank)`,
			"src/game/bank/server/Bank.luau": `local Sound = require(game:GetService("ServerScriptService").platform.sound.Sound)`,
		}),
		["src"],
	);
	assert.deepEqual(errors, []);
});

test("a cycle between features shows up through their requires", () => {
	const errors = cycleErrors(
		edgesOf({
			"src/features/shop/server/ShopService.luau": `local Q = require(game:GetService("ServerScriptService").features.quests.QuestService)`,
			"src/features/quests/server/QuestService.luau": `local S = require(game:GetService("ServerScriptService").features.shop.ShopService)`,
		}),
		["src"],
	);
	assert.equal(errors.length, 1);
	assert.match(errors[0] ?? "", /features\/quests and features\/shop import each other\./);
});

test("in a multi-place game the shared code never requires a place, nor a place another", () => {
	const roots = ["projects/common/src", "projects/lobby/src", "projects/game/src"];
	const errors = layerErrors(
		[
			["projects/common/src/features/a/server/A.luau", "projects/lobby/src/features/queue/server/Queue.luau"],
			["projects/lobby/src/features/queue/server/Queue.luau", "projects/game/src/features/m/server/M.luau"],
			["projects/lobby/src/features/queue/server/Queue.luau", "projects/common/src/game/bank/server/Bank.luau"],
		],
		roots,
	);
	assert.equal(errors.length, 2);
	assert.match(errors[0] ?? "", /the shared code never requires a place/);
	assert.match(errors[1] ?? "", /a place never requires another place/);
});

test("reads sourcemap paths from the folder it was written in, and ignores what it can't follow", () => {
	const map = sourcemap({ "ServerScriptService.game.a.A": "../common/src/game/a/server/A.luau" });
	const local = sourcemap({ "ServerScriptService.features.b.B": "../common/src/features/b/server/B.luau" });
	map.children?.push(...(local.children ?? []));
	const files = new Set(["projects/common/src/game/a/server/A.luau", "projects/common/src/features/b/server/B.luau"]);
	const edges = requireEdges(
		map,
		"projects/lobby",
		files,
		() => `local x = require(ServerScriptService.game.a.A)
local y = require(computed())
local z = require(script.Parent.Parent.Parent.Parent.Parent.Nope)`,
	);
	assert.deepEqual(edges, [
		["projects/common/src/features/b/server/B.luau", "projects/common/src/game/a/server/A.luau"],
	]);
});
