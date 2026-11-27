import assert from "node:assert/strict";
import { test } from "node:test";
import { unguardedRemotes } from "./unguarded-remotes.ts";

const NETWORK = `import { Networking } from "@flamework/networking";

interface ClientToServer {
	click(): void;
	buy(item: string, amount: number): void;
	shop: { open(): void };
}

interface ServerToClient {
	clicksChanged(clicks: number): void;
}

export const ShopNetwork = Networking.createEvent<ClientToServer, ServerToClient>();
`;

function check(server: string, network = NETWORK) {
	return unguardedRemotes(
		new Map([
			["src/features/shop/shared/shop-network.ts", network],
			["src/features/shop/server/shop-service.ts", `import { ShopNetwork } from "../shared/shop-network";\n${server}`],
		]),
	);
}

const remotes = (errors: string[]) => errors.map((error) => /"(\w+)"/.exec(error)?.[1]);

test("a remote with no middleware fails, and the message says what to do", () => {
	const errors = check("const events = ShopNetwork.createServer({});");
	assert.deepEqual(remotes(errors), ["click", "buy", "shop"]);
	assert.match(
		errors[0] ?? "",
		/^src\/features\/shop\/server\/shop-service\.ts: .*middleware that rate-limits it, `middleware: \{ click: \[rateLimit\(0\.5\)\] \}`.*trusts-client/,
	);
});

test("middleware entries guard their remotes, however the config is laid out", () => {
	const errors = check(`const events = ShopNetwork.createServer({
	middleware: {
		click: [rateLimit(20)],
		"buy": [rateLimit(5), (next) => (player, ...args) => next(player, ...args)],
		shop: { open: [rateLimit(1)] },
	},
});`);
	assert.deepEqual(errors, []);
});

test("an empty middleware list guards nothing", () => {
	const errors = check("ShopNetwork.createServer({ middleware: { click: [], buy: [ ], shop: {} } });");
	assert.deepEqual(remotes(errors), ["click", "buy", "shop"]);
});

test("trusts-client marks one handler, or the whole network", () => {
	const one =
		check(`const events = ShopNetwork.createServer({ middleware: { click: [rateLimit(20)], shop: { open: [rateLimit(1)] } } });
// trusts-client: buying is checked against the player's coins in the service
events.buy.connect(() => {});`);
	assert.deepEqual(one, []);
	const all = check(`// trusts-client: a test-only network
const events = ShopNetwork.createServer({});`);
	assert.deepEqual(all, []);
	const noReason = check(`const events = ShopNetwork.createServer({});
// trusts-client:
events.buy.connect(() => {});`);
	assert.deepEqual(remotes(noReason), ["click", "buy", "shop"]);
});

test("functions are checked too, and client code isn't", () => {
	const fn = NETWORK.replace("createEvent", "createFunction");
	assert.deepEqual(remotes(check("const fns = ShopNetwork.createServer({});", fn)), ["click", "buy", "shop"]);
	const client = unguardedRemotes(
		new Map([
			["src/features/shop/shared/shop-network.ts", NETWORK],
			[
				"src/features/shop/client/shop-controller.ts",
				`import { ShopNetwork } from "../shared/shop-network";\nShopNetwork.createClient({});`,
			],
		]),
	);
	assert.deepEqual(client, []);
});

test("a multi-place game's place reaches the network in projects/common", () => {
	const errors = unguardedRemotes(
		new Map([
			["projects/common/src/features/shop/shared/shop-network.ts", NETWORK],
			[
				"projects/lobby/src/features/lobby/server/lobby-service.ts",
				`import { ShopNetwork as Shop } from "../../../../../common/src/features/shop/shared/shop-network";\nShop.createServer({ middleware: { click: [rateLimit(20)] } });`,
			],
		]),
	);
	assert.deepEqual(remotes(errors), ["buy", "shop"]);
	assert.match(errors[0] ?? "", /projects\/common\/src\/features\/shop\/shared\/shop-network\.ts/);
});

test("a network the check can't find fails rather than passing unchecked", () => {
	const errors = unguardedRemotes(
		new Map([
			[
				"src/features/shop/server/shop-service.ts",
				`import { ShopNetwork } from "@some/package";\nShopNetwork.createServer({});`,
			],
		]),
	);
	assert.match(errors[0] ?? "", /can't find where ShopNetwork is created/);
});
