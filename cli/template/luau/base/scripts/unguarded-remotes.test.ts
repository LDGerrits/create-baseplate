import assert from "node:assert/strict";
import { test } from "node:test";
import { unguardedRemotes } from "./unguarded-remotes.ts";

test("flags OnServerEvent and OnServerInvoke outside Network/Server", () => {
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

test("lets Serve.luau take remotes", () => {
	const serve = "remote.instance.OnServerEvent:Connect(handler)\nremote.instance.OnServerInvoke = handler";
	assert.deepEqual(unguardedRemotes(new Map([["src/Network/Server/Serve.luau", serve]])), []);
	assert.deepEqual(unguardedRemotes(new Map([["projects/common/src/Network/Server/Serve.luau", serve]])), []);
});

test("ignores remotes named in comments", () => {
	const code = "-- never use remote.OnServerEvent directly\n--[[ OnServerInvoke ]]\nlocal x = 1";
	assert.deepEqual(unguardedRemotes(new Map([["src/Features/Shop/Server/ShopService.luau", code]])), []);
});
