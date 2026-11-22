import assert from "node:assert/strict";
import { test } from "node:test";
import { unguardedRemotes } from "./unguarded-remotes.ts";

test("flags OnServerEvent and OnServerInvoke outside Serve.luau", () => {
	const problems = unguardedRemotes(
		new Map([
			[
				"src/Features/Shop/Server/ShopService.luau",
				"local remote = folder.Buy\nremote.OnServerEvent:Connect(function() end)",
			],
			["src/Features/Shop/Server/Prices.luau", "prices.OnServerInvoke = function() end"],
		]),
	);
	assert.equal(problems.length, 2);
	assert.match(problems[0] ?? "", /^src\/Features\/Shop\/Server\/ShopService\.luau:2: OnServerEvent/);
	assert.match(problems[1] ?? "", /^src\/Features\/Shop\/Server\/Prices\.luau:1: OnServerInvoke/);
});

test("isn't fooled by indexing, spacing, strings holding -- or a folder named like Serve's", () => {
	const evasions = [
		'remote["OnServerEvent"]:Connect(handler)',
		"remote. OnServerEvent:Connect(handler)",
		"remote.\nOnServerEvent:Connect(handler)",
		'fn["OnServerInvoke"] = handler',
		'local u = "a--b"; remote.OnServerEvent:Connect(handler)',
	];
	for (const code of evasions) {
		assert.equal(unguardedRemotes(new Map([["src/Features/Shop/Server/ShopService.luau", code]])).length, 1, code);
	}
	const lookalike = "src/Features/Network/Server/NetworkService.luau";
	assert.equal(unguardedRemotes(new Map([[lookalike, "remote.OnServerEvent:Connect(handler)"]])).length, 1);
});

test("lets Serve.luau take remotes", () => {
	const serve = "remote.instance.OnServerEvent:Connect(handler)\nremote.instance.OnServerInvoke = handler";
	assert.deepEqual(unguardedRemotes(new Map([["src/Network/Server/Serve.luau", serve]])), []);
	assert.deepEqual(unguardedRemotes(new Map([["projects/common/src/Network/Server/Serve.luau", serve]])), []);
});

test("ignores remotes named in comments", () => {
	const code = "-- never use remote.OnServerEvent directly\n--[[ OnServerInvoke ]]\nlocal x = 1";
	assert.deepEqual(unguardedRemotes(new Map([["src/Features/Shop/Server/ShopService.luau", code]])), []);
});
