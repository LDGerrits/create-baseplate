import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { addImport, createFeature } from "./feature.ts";

const SERVER = `import { Flamework } from "@flamework/core";

// Every server feature's services.
import "../../features/clicker/server/clicker-service";

Flamework.ignite();
`;
const CLIENT = `import { App } from "./app";

// Every client feature's controllers.
import "../../features/clicker/client/clicker-controller";

export function start() {}
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

test("adds an import after the last feature import, once", () => {
	const once = addImport(SERVER, "../../features/shop/server/shop-service");
	assert.match(once, /clicker-service";\nimport "..\/..\/features\/shop\/server\/shop-service";\n\nFlamework/);
	assert.equal(addImport(once, "../../features/shop/server/shop-service"), once);
});

test("adds the import before Flamework.ignite() when no feature is imported yet", () => {
	assert.match(addImport("Flamework.ignite();\n", "../x"), /^import "..\/x";\n\nFlamework\.ignite\(\);/);
	assert.throws(() => addImport("nothing\n", "../x"), /Flamework\.ignite/);
});

test("starts a feature in a single-place game and imports it in the entry scripts", () => {
	const dir = game({ "src/app/server/main.server.ts": SERVER, "src/app/client/start.tsx": CLIENT });
	createFeature(dir, "daily-reward");
	for (const file of [
		"shared/daily-reward-network.ts",
		"server/daily-reward-service.ts",
		"server/daily-reward-service.spec.ts",
		"client/daily-reward-controller.ts",
	]) {
		assert.ok(fs.existsSync(path.join(dir, "src/features/daily-reward", file)), file);
	}
	const service = read(dir, "src/features/daily-reward/server/daily-reward-service.ts");
	assert.match(service, /export class DailyRewardService/);
	assert.match(service, /from "\.\.\/\.\.\/\.\.\/network\/server\/rate-limit"/);
	assert.match(
		read(dir, "src/app/server/main.server.ts"),
		/import "\.\.\/\.\.\/features\/daily-reward\/server\/daily-reward-service";/,
	);
	assert.match(
		read(dir, "src/app/client/start.tsx"),
		/import "\.\.\/\.\.\/features\/daily-reward\/client\/daily-reward-controller";/,
	);
});

test("puts a multi-place feature in the shared code and imports it in every place", () => {
	const dir = game({
		"projects/common/src/network/server/rate-limit.ts": "",
		"projects/lobby/src/app/server/main.server.ts": SERVER,
		"projects/lobby/src/app/client/start.tsx": CLIENT,
		"projects/game/src/app/server/main.server.ts": SERVER,
		"projects/game/src/app/client/start.tsx": CLIENT,
	});
	createFeature(dir, "shop");
	assert.ok(fs.existsSync(path.join(dir, "projects/common/src/features/shop/server/shop-service.ts")));
	for (const place of ["lobby", "game"]) {
		assert.match(
			read(dir, `projects/${place}/src/app/server/main.server.ts`),
			/import "\.\.\/\.\.\/\.\.\/\.\.\/common\/src\/features\/shop\/server\/shop-service";/,
		);
	}
});

test("keeps a --place feature to that place, reaching the shared network helpers", () => {
	const dir = game({
		"projects/common/src/network/server/rate-limit.ts": "",
		"projects/lobby/src/app/server/main.server.ts": SERVER,
		"projects/lobby/src/app/client/start.tsx": CLIENT,
		"projects/game/src/app/server/main.server.ts": SERVER,
		"projects/game/src/app/client/start.tsx": CLIENT,
	});
	createFeature(dir, "queue", "lobby");
	assert.match(
		read(dir, "projects/lobby/src/features/queue/server/queue-service.ts"),
		/from "\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/common\/src\/network\/server\/rate-limit"/,
	);
	assert.match(read(dir, "projects/lobby/src/app/server/main.server.ts"), /features\/queue\/server\/queue-service/);
	assert.doesNotMatch(read(dir, "projects/game/src/app/server/main.server.ts"), /queue/);
});

test("refuses a bad name, a place that isn't there and a feature that exists", () => {
	const dir = game({ "src/app/server/main.server.ts": SERVER, "src/app/client/start.tsx": CLIENT });
	assert.throws(() => createFeature(dir, "Shop"), /kebab-case/);
	assert.throws(() => createFeature(dir, "shop", "lobby"), /one place/);
	createFeature(dir, "shop");
	assert.throws(() => createFeature(dir, "shop"), /already exists/);
});
