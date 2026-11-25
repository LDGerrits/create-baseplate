import assert from "node:assert/strict";
import { test } from "node:test";
import config from "../eslint.config.ts";

test("one rule reports a truthiness mistake: roblox-ts/lua-truthiness, which tells agents to turn itself off, is off", () => {
	const rules = Object.assign({}, ...config.map((block) => block.rules ?? {})) as Record<string, unknown>;
	assert.equal(rules["roblox-ts/lua-truthiness"], "off");
	assert.ok(Array.isArray(rules["@typescript-eslint/strict-boolean-expressions"]));
});
