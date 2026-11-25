import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { addImport, createFeature } from "./feature.ts";

const SERVER = `import { Flamework } from "@flamework/core";

// Import each service here.

Flamework.ignite();
`;
const CLIENT = `import { Flamework } from "@flamework/core";

// Import each controller here.

Flamework.ignite();
`;

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

test("adds the import before Flamework.ignite() when no feature is imported yet", () => {
	assert.match(addImport("Flamework.ignite();\n", "../x"), /^import "..\/x";\n\nFlamework\.ignite\(\);/);
	assert.match(
		addImport(SERVER, "../../features/shop/server/shop-service"),
		/\/\/ Import each service here\.\n\nimport "..\/..\/features\/shop\/server\/shop-service";\n\nFlamework\.ignite\(\);/,
	);
	assert.throws(() => addImport("nothing\n", "../x"), /Flamework\.ignite/);
});

test("adds an import after the last feature import, once", () => {
	const first = addImport(SERVER, "../../features/shop/server/shop-service");
	const once = addImport(first, "../../features/quest/server/quest-service");
	assert.match(once, /shop-service";\nimport "..\/..\/features\/quest\/server\/quest-service";\n\nFlamework/);
	assert.equal(addImport(once, "../../features/quest/server/quest-service"), once);
});

test("starts a feature in a single-place game and imports it in the entry scripts", () => {
	const dir = game({ "src/app/server/main.server.ts": SERVER, "src/app/client/main.client.ts": CLIENT });
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
	assert.match(service, /\/\/ trusts-client: /);
	assert.match(
		read(dir, "src/app/server/main.server.ts"),
		/import "\.\.\/\.\.\/features\/daily-reward\/server\/daily-reward-service";/,
	);
	assert.match(
		read(dir, "src/app/client/main.client.ts"),
		/import "\.\.\/\.\.\/features\/daily-reward\/client\/daily-reward-controller";/,
	);
});

test("puts a multi-place feature in the shared code and imports it in every place", () => {
	const dir = game({
		"projects/lobby/src/app/server/main.server.ts": SERVER,
		"projects/lobby/src/app/client/main.client.ts": CLIENT,
		"projects/game/src/app/server/main.server.ts": SERVER,
		"projects/game/src/app/client/main.client.ts": CLIENT,
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

test("keeps a --place feature to that place", () => {
	const dir = game({
		"projects/lobby/src/app/server/main.server.ts": SERVER,
		"projects/lobby/src/app/client/main.client.ts": CLIENT,
		"projects/game/src/app/server/main.server.ts": SERVER,
		"projects/game/src/app/client/main.client.ts": CLIENT,
	});
	createFeature(dir, "queue", "lobby");
	assert.ok(fs.existsSync(path.join(dir, "projects/lobby/src/features/queue/server/queue-service.ts")));
	assert.match(read(dir, "projects/lobby/src/app/server/main.server.ts"), /features\/queue\/server\/queue-service/);
	assert.doesNotMatch(read(dir, "projects/game/src/app/server/main.server.ts"), /queue/);
});

test("refuses a bad name, a place that isn't there and a feature that exists", () => {
	const dir = game({ "src/app/server/main.server.ts": SERVER, "src/app/client/main.client.ts": CLIENT });
	assert.throws(() => createFeature(dir, "Shop"), /kebab-case/);
	assert.throws(() => createFeature(dir, "shop", "lobby"), /one place/);
	createFeature(dir, "shop");
	assert.throws(() => createFeature(dir, "shop"), /already exists/);
});
