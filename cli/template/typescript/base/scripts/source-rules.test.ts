import assert from "node:assert/strict";
import { test } from "node:test";
import { disableErrors, namingErrors } from "./source-rules.ts";

test("file names are kebab-case, with dotted suffixes", () => {
	assert.deepEqual(
		namingErrors([
			"src/app/server/main.server.ts",
			"src/features/shop/server/shop-service.spec.ts",
			"src/features/shop/client/shop-panel.story.tsx",
			"src/features/shop/server/ShopService.ts",
			"src/features/shop/server/shop_service.ts",
		]),
		[
			"src/features/shop/server/ShopService.ts: file names are kebab-case: shop-service.ts.",
			"src/features/shop/server/shop_service.ts: file names are kebab-case: shop-service.ts.",
		],
	);
});

test("an eslint-disable comment says why", () => {
	const source = [
		"// eslint-disable-next-line roblox-ts/no-any -- the package's types are wrong",
		"// eslint-disable-next-line roblox-ts/no-any",
		"const a = 1; // eslint-disable-line prefer-const",
		"/* eslint-disable no-console -- a debug script */",
		"/* eslint-disable */",
		"// eslint-disable-next-line x -- ",
	].join("\n");
	assert.deepEqual(
		disableErrors("a.ts", source).map((error) => error.split(":").slice(0, 2).join(":")),
		["a.ts:2", "a.ts:3", "a.ts:5", "a.ts:6"],
	);
});
