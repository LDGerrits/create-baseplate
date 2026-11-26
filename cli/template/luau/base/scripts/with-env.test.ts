import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pick } from "./with-env.ts";

const ENV = `# keys
ROBLOX_OPEN_CLOUD_API_KEY=test-key
ROBLOX_PUBLISH_API_KEY="publish key"
ROBLOX_PUBLISH_PLACE_ID=123
RUR_ROBLOX_CONTENT=
`;

test("takes only the named variables, and prefixes ending in *", () => {
	assert.deepEqual(pick(ENV, ["ROBLOX_OPEN_CLOUD_API_KEY"]), { ROBLOX_OPEN_CLOUD_API_KEY: "test-key" });
	assert.deepEqual(pick(ENV, ["ROBLOX_PUBLISH_*"]), {
		ROBLOX_PUBLISH_API_KEY: "publish key",
		ROBLOX_PUBLISH_PLACE_ID: "123",
	});
	assert.deepEqual(pick(ENV, ["RUR_ROBLOX_CONTENT", "MISSING"]), { RUR_ROBLOX_CONTENT: "" });
});

test("the command gets the picked variables and the environment, which wins over .env", () => {
	const script = path.join(import.meta.dirname, "with-env.ts");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "with-env-"));
	try {
		fs.writeFileSync(path.join(dir, ".env"), ENV);
		const print =
			"console.log(JSON.stringify([process.env.ROBLOX_OPEN_CLOUD_API_KEY, process.env.ROBLOX_PUBLISH_API_KEY, process.env.ROBLOX_PUBLISH_PLACE_ID]))";
		const run = spawnSync(process.execPath, [script, "ROBLOX_PUBLISH_*", "--", process.execPath, "-e", print], {
			encoding: "utf8",
			env: { ...process.env, ROBLOX_PUBLISH_PLACE_ID: "456" },
			cwd: dir,
		});
		assert.equal(run.status, 0, run.stderr);
		assert.deepEqual(JSON.parse(run.stdout), [null, "publish key", "456"]);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
