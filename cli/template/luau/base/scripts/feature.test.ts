import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { addEntry, createFeature } from "./feature.ts";

const SERVER = `local services: { { start: () -> () } } = {
	require(ServerScriptService.features.clicker.ClickerService),
}
`;
const CLIENT = `local controllers: { { start: () -> () } } = {
	require(features.clicker.ClickerController),
}
`;

function game(files: Record<string, string>) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feature-"));
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

test("adds a require after the last feature in the list, once", () => {
	const line = "\trequire(ServerScriptService.features.shop.ShopService),";
	const once = addEntry(SERVER, line, /^\trequire\(ServerScriptService\.features\..*\),$/);
	assert.match(once, /ClickerService\),\n\trequire\(ServerScriptService\.features\.shop\.ShopService\),\n\}/);
	assert.equal(addEntry(once, line, /^\trequire\(ServerScriptService\.features\..*\),$/), once);
	assert.throws(() => addEntry("nothing\n", line, /^\trequire\(features\..*\),$/), /No list of requires/);
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
	assert.match(
		read(dir, "src/app/server/Main.server.luau"),
		/require\(ServerScriptService\.features\.shop\.ShopService\),/,
	);
	assert.match(read(dir, "src/app/client/Start.luau"), /require\(features\.shop\.ShopController\),/);
});

test("puts a multi-place feature in the shared code and lists it in every place", () => {
	const dir = game({ ...entries("projects/lobby/src"), ...entries("projects/game/src"), "projects/common/src/x": "" });
	createFeature(dir, "shop");
	assert.ok(fs.existsSync(path.join(dir, "projects/common/src/features/shop/server/ShopService.luau")));
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

test("refuses a bad name, a place that isn't there and a feature that exists", () => {
	const dir = game(entries("src"));
	assert.throws(() => createFeature(dir, "daily-reward"), /lowercase letters and digits/);
	assert.throws(() => createFeature(dir, "shop", "lobby"), /one place/);
	createFeature(dir, "shop");
	assert.throws(() => createFeature(dir, "shop"), /already exists/);
});
