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

const network = (
	request: string,
	type = "Remo.ClientToServer<number>",
) => `local Remo = require(ReplicatedStorage.Packages.Remo)
local t = require(ReplicatedStorage.Packages.t)

type Remotes = {
	shop: {
		buy: ${type},
		changed: Remo.ServerToClient<number>,
	},
}

local remotes: Remotes = Remo.createRemotes({
	shop = Remo.namespace({
${request}
		changed = Remo.remote(t.number),
	}),
})
`;
const remoProblems = (code: string) => unguardedRemotes(new Map([["src/features/shop/shared/ShopNetwork.luau", code]]));

test("passes a Remo remote that clients send with validators and a throttle", () => {
	assert.deepEqual(
		remoProblems(network("\t\tbuy = Remo.remote(t.integer).middleware(Remo.throttleMiddleware(1)),")),
		[],
	);
	const noArguments = network(
		"\t\tbuy = Remo.remote().middleware(Remo.throttleMiddleware(0.1)),",
		"Remo.ClientToServer<()>",
	);
	assert.deepEqual(remoProblems(noArguments), []);
	const request = network(
		"\t\tbuy = Remo.remote(t.number)\n\t\t\t.returns(t.string)\n\t\t\t.middleware(Remo.throttleMiddleware(1)),",
		"Remo.ServerAsync<(number), (string)>",
	);
	assert.deepEqual(remoProblems(request), []);
});

test("flags a Remo remote that clients send with no throttle, or no validators for its arguments", () => {
	const unthrottled = remoProblems(network("\t\tbuy = Remo.remote(t.integer),"));
	assert.equal(unthrottled.length, 1);
	assert.match(
		unthrottled[0] ?? "",
		/^src\/features\/shop\/shared\/ShopNetwork\.luau:13: the remote "buy" .* no throttle/,
	);
	const unvalidated = remoProblems(network("\t\tbuy = Remo.remote().middleware(Remo.throttleMiddleware(1)),"));
	assert.equal(unvalidated.length, 1);
	assert.match(unvalidated[0] ?? "", /"buy" takes number from clients with no validators/);
	const request = remoProblems(
		network("\t\tbuy = Remo.remote().returns(t.string),", "Remo.ServerAsync<(number, string), (string)>"),
	);
	assert.equal(request.length, 2, request.join("\n"));
});

test("lets a Remo remote through when the line above says why it trusts the client", () => {
	const trusted = network(
		"\t\t-- trusts-client: only reads, and a reply costs nothing\n\t\tbuy = Remo.remote(t.integer),",
	);
	assert.deepEqual(remoProblems(trusted), []);
});

test("flags Remo.createRemotes with no Remotes type", () => {
	const untyped = "local remotes = Remo.createRemotes({\n\tbuy = Remo.remote(t.integer),\n})";
	assert.match(remoProblems(untyped)[0] ?? "", /:1: Remo\.createRemotes has no Remotes type/);
});
