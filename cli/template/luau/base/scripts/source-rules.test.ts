import assert from "node:assert/strict";
import { test } from "node:test";
import { namingErrors, silencedErrors } from "./source-rules.ts";

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
