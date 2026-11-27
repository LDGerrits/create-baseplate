import assert from "node:assert/strict";
import { test } from "node:test";
import {
	dataStoreErrors,
	duplicateErrors,
	e2eErrors,
	focusedErrors,
	namingErrors,
	silencedErrors,
	specErrors,
	storyErrors,
} from "./source-rules.ts";

test("file names are PascalCase, with dotted suffixes", () => {
	assert.deepEqual(
		namingErrors([
			"src/app/server/Main.server.luau",
			"src/features/shop/server/ShopService.spec.luau",
			"src/features/shop/client/init.luau",
			"src/features/shop/server/shopService.luau",
			"src/features/shop/server/shop-service.spec.luau",
		]),
		[
			"src/features/shop/server/shopService.luau: file names are PascalCase, since they're module names: ShopService.luau.",
			"src/features/shop/server/shop-service.spec.luau: file names are PascalCase, since they're module names: ShopService.spec.luau.",
		],
	);
});

test("a selene allow and an any cast say why", () => {
	const source = [
		"-- selene: allow(global_usage) -- _G is how the test runner hands it over",
		"-- selene: allow(global_usage)",
		"local mock = Mock.new() :: any -- the mock doesn't match DataStoreService's type",
		"local x = y :: any",
		"-- a comment that mentions :: any",
	].join("\n");
	assert.deepEqual(
		silencedErrors("A.luau", source).map((error) => error.split(":").slice(0, 2).join(":")),
		["A.luau:2", "A.luau:4"],
	);
});

const sources = (files: Record<string, string>) => [Object.keys(files), (file: string) => files[file] ?? ""] as const;
const firstPart = (error: string) => error.split(":")[0];

test("a service has a spec, unless it says why not", () => {
	const [files, read] = sources({
		"src/features/shop/server/ShopService.luau": "",
		"src/features/shop/server/ShopService.spec.luau": "",
		"src/features/bank/server/BankService.luau": "",
		"src/features/spin/server/SpinService.luau": "-- no-spec: it only starts the spin system, whose spec tests it",
	});
	assert.deepEqual(specErrors(files, read).map(firstPart), ["src/features/bank/server/BankService.luau"]);
});

test("a feature with remotes has an end-to-end test, unless it says why not", () => {
	const [files, read] = sources({
		"src/features/shop/shared/ShopNetwork.luau": "request: Remo.ClientToServer<()>",
		"src/features/bank/shared/BankNetwork.luau": "deposit: Remo.ClientToServer<number>",
		"src/features/log/shared/LogNetwork.luau": "-- no-e2e: tested by hand\nsend: Remo.ClientToServer<string>",
		"src/features/round/shared/RoundNetwork.luau": "tick: Remo.ServerToClient<number>",
	});
	assert.deepEqual(e2eErrors(files, ["tests/e2e/shop.luau"], read).map(firstPart), [
		"src/features/bank/shared/BankNetwork.luau",
	]);
});

test("a client module that creates UI has a story, unless it says why not", () => {
	const [files, read] = sources({
		"src/features/shop/client/ShopPanel.luau": 'return function() return React.createElement("Frame") end',
		"src/features/shop/client/ShopPanel.story.luau": "",
		"src/features/shop/client/PriceTag.luau": 'return function() return Vide.create "TextLabel" {} end',
		"src/features/shop/client/ShopController.luau": "root:render(React.createElement(App))",
		"src/features/shop/client/Prices.luau": "return { cost = 5 }",
		"src/app/client/Root.luau": '-- no-story: it only mounts the screens\nReact.createElement("ScreenGui")',
	});
	assert.deepEqual(storyErrors(files, read).map(firstPart), ["src/features/shop/client/PriceTag.luau"]);
});

test("player data goes through a data library, unless the line above says why not", () => {
	const source = [
		'local DataStoreService = game:GetService("DataStoreService")',
		"-- datastore: a leaderboard's ordered store",
		'local Ordered = game:GetService("DataStoreService")',
	].join("\n");
	assert.deepEqual(
		dataStoreErrors("A.luau", source).map((error) => error.split(":").slice(0, 2).join(":")),
		["A.luau:1"],
	);
});

test("a package whose state the game shares, in two versions, is an error; another isn't", () => {
	const lock = [
		'[[package]]\nname = "littensy/charm"\nversion = "0.10.0"',
		'[[package]]\nname = "littensy/charm"\nversion = "0.11.1"',
		'[[package]]\nname = "jsdotlua/react-is"\nversion = "17.2.1"',
		'[[package]]\nname = "jsdotlua/react-is"\nversion = "17.1.0"',
	].join("\n\n");
	assert.deepEqual(
		duplicateErrors(lock).map((error) => error.split(" is installed")[0]),
		["wally.lock: littensy/charm"],
	);
});
