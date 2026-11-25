import assert from "node:assert/strict";
import { test } from "node:test";
import { unguardedRemotes } from "./unguarded-remotes.ts";

test("flags OnServerEvent and OnServerInvoke", () => {
	const problems = unguardedRemotes(
		new Map([
			[
				"src/features/shop/server/ShopService.luau",
				"local remote = folder.Buy\nremote.OnServerEvent:Connect(function() end)",
			],
			["src/features/shop/server/Prices.luau", "prices.OnServerInvoke = function() end"],
		]),
	);
	assert.equal(problems.length, 2);
	assert.match(problems[0] ?? "", /^src\/features\/shop\/server\/ShopService\.luau:2: OnServerEvent/);
	assert.match(problems[1] ?? "", /^src\/features\/shop\/server\/Prices\.luau:1: OnServerInvoke/);
});

test("isn't fooled by indexing, spacing or strings holding --", () => {
	const evasions = [
		'remote["OnServerEvent"]:Connect(handler)',
		"remote. OnServerEvent:Connect(handler)",
		"remote.\nOnServerEvent:Connect(handler)",
		'fn["OnServerInvoke"] = handler',
		'local u = "a--b"; remote.OnServerEvent:Connect(handler)',
	];
	for (const code of evasions) {
		assert.equal(unguardedRemotes(new Map([["src/features/shop/server/ShopService.luau", code]])).length, 1, code);
	}
});

test("ignores remotes named in comments", () => {
	const code = "-- never use remote.OnServerEvent directly\n--[[ OnServerInvoke ]]\nlocal x = 1";
	assert.deepEqual(unguardedRemotes(new Map([["src/features/shop/server/ShopService.luau", code]])), []);
});
