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
		/^src\/features\/shop\/shared\/ShopNetwork\.luau:13: the remote "shop\.buy" .* no throttle/,
	);
	const unvalidated = remoProblems(network("\t\tbuy = Remo.remote().middleware(Remo.throttleMiddleware(1)),"));
	assert.equal(unvalidated.length, 1);
	assert.match(unvalidated[0] ?? "", /"shop\.buy" takes 1 argument from clients \(number\) but has 0 validators/);
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

test("checks a remote declared in a local above createRemotes, and one typed through an alias", () => {
	const local = `local Remo = require(ReplicatedStorage.Packages.Remo)
type Buy = Remo.ClientToServer<number>
type Remotes = { shop: { buy: Buy } }
local buy = Remo.remote(t.integer)
local remotes: Remotes = Remo.createRemotes({
	shop = Remo.namespace({ buy = buy }),
})
`;
	const problems = remoProblems(local);
	assert.equal(problems.length, 1, problems.join("\n"));
	assert.match(problems[0] ?? "", /:4: the remote "shop\.buy" .* no throttle/);
	const throttled = local.replace(
		"Remo.remote(t.integer)",
		"Remo.remote(t.integer)\n\t.middleware(Remo.throttleMiddleware(1))",
	);
	assert.deepEqual(remoProblems(throttled), []);
});

test("counts a validator for each argument a client sends, and reads function types", () => {
	const two = network(
		"\t\tbuy = Remo.remote(t.number).middleware(Remo.throttleMiddleware(1)),",
		"Remo.ClientToServer<number, string>",
	);
	assert.match(remoProblems(two)[0] ?? "", /takes 2 arguments from clients \(number, string\) but has 1 validator/);
	const callback = network(
		"\t\tbuy = Remo.remote(t.callback).middleware(Remo.throttleMiddleware(1)),",
		"Remo.ClientToServer<(number) -> ()>",
	);
	assert.deepEqual(remoProblems(callback), []);
});

test("tells namespaces apart: a server-to-client remote of the same name needs no throttle", () => {
	const code = `local Remo = require(ReplicatedStorage.Packages.Remo)
type Remotes = {
	shop: { buy: Remo.ClientToServer<number> },
	inventory: { buy: Remo.ServerToClient<number> },
}
local remotes: Remotes = Remo.createRemotes({
	shop = Remo.namespace({ buy = Remo.remote(t.number).middleware(Remo.throttleMiddleware(1)) }),
	inventory = Remo.namespace({ buy = Remo.remote(t.number) }),
})
`;
	assert.deepEqual(remoProblems(code), []);
});

test("flags a remote clients send that createRemotes doesn't declare where the check can see it", () => {
	const code = `type Remotes = { shop: { buy: Remo.ClientToServer<number> } }
local remotes: Remotes = Remo.createRemotes({ shop = makeShop() })
`;
	assert.match(remoProblems(code)[0] ?? "", /can't find where the remote "shop\.buy"/);
});
