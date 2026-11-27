import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { addEntry, createFeature } from "./feature.ts";

const SERVER = `local services: { { start: () -> () } } = {}

for _, service in services do
	service.start()
end
`;
const CLIENT = `local controllers: { { start: () -> () } } = {}

local Start = {}
`;
const SERVICES = /^\trequire\(ServerScriptService\.features\..*\),$/;
const PRELUDE = 'local ServerScriptService = game:GetService("ServerScriptService")';

// Each test's folder, removed when the file's tests end.
const temps: string[] = [];
after(() => {
	for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
});

function game(files: Record<string, string>) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feature-"));
	temps.push(dir);
	for (const [file, text] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		fs.writeFileSync(path.join(dir, file), text);
	}
	return dir;
}
const read = (dir: string, file: string) => fs.readFileSync(path.join(dir, file), "utf8");
const entries = (root: string) => ({
	[`${root}/app/server/Main.server.luau`]: SERVER,
	[`${root}/app/client/Start.luau`]: CLIENT,
});

test("opens an empty list, then adds after the last feature in it, once", () => {
	const shop = "\trequire(ServerScriptService.features.shop.ShopService),";
	const quest = "\trequire(ServerScriptService.features.quest.QuestService),";
	const add = (source: string, line: string) => addEntry(source, line, SERVICES, /^local services\b/, PRELUDE);
	const first = add(SERVER, shop);
	assert.match(
		first,
		/^local ServerScriptService = game:GetService\("ServerScriptService"\)\n\nlocal services: .* = \{\n\trequire\(.*ShopService\),\n\}\n/,
	);
	const second = add(first, quest);
	assert.match(second, /ShopService\),\n\trequire\(ServerScriptService\.features\.quest\.QuestService\),\n\}/);
	assert.equal(second.split(PRELUDE).length, 2);
	assert.equal(add(second, quest), second);
	assert.throws(() => add("nothing\n", shop), /No list of requires/);
});

test("starts a feature in a single-place game and lists it in the entry scripts", () => {
	const dir = game(entries("src"));
	createFeature(dir, "shop");
	for (const file of [
		"shared/ShopNetwork.luau",
		"server/ShopService.luau",
		"server/ShopService.spec.luau",
		"client/ShopController.luau",
	]) {
		assert.ok(fs.existsSync(path.join(dir, "src/features/shop", file)), file);
	}
	assert.match(read(dir, "src/features/shop/server/ShopService.luau"), /ShopNetwork\.request:connect\(/);
	assert.match(read(dir, "tests/e2e/shop.luau"), /remote\("request"\):FireServer\(\)/);
	assert.match(
		read(dir, "src/app/server/Main.server.luau"),
		/require\(ServerScriptService\.features\.shop\.ShopService\),/,
	);
	const client = read(dir, "src/app/client/Start.luau");
	assert.match(client, /local features = script\.Parent\.Parent\.features\n\nlocal controllers/);
	assert.match(client, /require\(features\.shop\.ShopController\),/);
});

test("puts a multi-place feature in the shared code and lists it in every place", () => {
	const dir = game({ ...entries("projects/lobby/src"), ...entries("projects/game/src"), "projects/common/src/x": "" });
	createFeature(dir, "shop");
	assert.ok(fs.existsSync(path.join(dir, "projects/common/src/features/shop/server/ShopService.luau")));
	assert.ok(fs.existsSync(path.join(dir, "projects/game/tests/e2e/shop.luau")));
	for (const place of ["lobby", "game"]) {
		assert.match(read(dir, `projects/${place}/src/app/server/Main.server.luau`), /features\.shop\.ShopService/);
	}
});

test("keeps a place's feature to that place", () => {
	const dir = game({ ...entries("projects/lobby/src"), ...entries("projects/game/src"), "projects/common/src/x": "" });
	createFeature(dir, "queue", "lobby");
	assert.ok(fs.existsSync(path.join(dir, "projects/lobby/src/features/queue/server/QueueService.luau")));
	assert.match(read(dir, "projects/lobby/src/app/client/Start.luau"), /features\.queue\.QueueController/);
	assert.doesNotMatch(read(dir, "projects/game/src/app/client/Start.luau"), /queue/);
});

test("names a camelCase feature's modules in PascalCase, in a lowercase folder", () => {
	const dir = game(entries("src"));
	const written = createFeature(dir, "dailyReward");
	assert.ok(written.includes("src/features/dailyreward/server/DailyRewardService.luau"), written.join("\n"));
	const service = fs.readFileSync(path.join(dir, "src/features/dailyreward/server/DailyRewardService.luau"), "utf8");
	assert.match(service, /features\.dailyreward\.DailyRewardNetwork/);
	assert.match(
		fs.readFileSync(path.join(dir, "src/app/server/Main.server.luau"), "utf8"),
		/features\.dailyreward\.DailyRewardService/,
	);
});

test("refuses a bad name, a place that isn't there and a feature that exists", () => {
	const dir = game(entries("src"));
	assert.throws(() => createFeature(dir, "daily-reward"), /camelCase/);
	assert.throws(() => createFeature(dir, "shop", "lobby"), /one place/);
	createFeature(dir, "shop");
	assert.throws(() => createFeature(dir, "shop"), /already exists/);
});

test("lists a feature after a game system's service, such as the player data add-on's", () => {
	const dir = game({
		"src/app/server/Main.server.luau": `local ServerScriptService = game:GetService("ServerScriptService")

local services: { { start: () -> () } } = {
	require(ServerScriptService.game.playerdata.PlayerDataService),
}
`,
		"src/app/client/Start.luau": CLIENT,
	});
	createFeature(dir, "shop");
	assert.match(
		read(dir, "src/app/server/Main.server.luau"),
		/PlayerDataService\),\n\trequire\(ServerScriptService\.features\.shop\.ShopService\),\n\}/,
	);
});
