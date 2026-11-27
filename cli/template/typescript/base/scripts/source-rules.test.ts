import assert from "node:assert/strict";
import { test } from "node:test";
import {
	disableErrors,
	duplicateErrors,
	e2eErrors,
	mountedScopes,
	namingErrors,
	packageErrors,
	specErrors,
	storyErrors,
} from "./source-rules.ts";

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

const sources = (files: Record<string, string>) => [Object.keys(files), (file: string) => files[file] ?? ""] as const;

test("a service has a spec, unless it says why not", () => {
	const [files, read] = sources({
		"src/features/shop/server/shop-service.ts": "",
		"src/features/shop/server/shop-service.spec.ts": "",
		"src/features/bank/server/bank-service.ts": "",
		"src/features/spin/server/spin-service.ts": "// no-spec: it only starts the spin system, whose spec tests it",
	});
	assert.deepEqual(
		specErrors(files, read).map((error) => error.split(":")[0]),
		["src/features/bank/server/bank-service.ts"],
	);
});

test("a feature with remotes has an end-to-end test, unless it says why not", () => {
	const [files, read] = sources({
		"src/features/shop/shared/shop-network.ts": "",
		"src/features/bank/shared/bank-network.ts":
			"interface ClientToServer { deposit(amount: number): void; }\nexport const BankNetwork = Networking.createEvent<ClientToServer, {}>();",
		"src/features/log/shared/log-network.ts": "// no-e2e: tested by hand",
		"src/features/timer/shared/timer-network.ts":
			"type ClientToServer = Record<string, never>\ninterface ServerToClient { tick(left: number): void; }\nexport const TimerNetwork = Networking.createEvent<ClientToServer, ServerToClient>();",
		"src/features/round/shared/round-network.ts":
			"interface ClientToServer {}\ninterface ServerToClient { tick(left: number): void; }\nexport const RoundNetwork = Networking.createEvent<ClientToServer, ServerToClient>();",
		"projects/common/src/features/queue/shared/queue-network.ts": "",
	});
	assert.deepEqual(
		e2eErrors(files, ["tests/e2e/shop.luau", "projects/game/tests/e2e/queue.luau"], read, (file) =>
			file.startsWith("projects/") ? "projects/game/tests/e2e" : "tests/e2e",
		).map((error) => error.split(":")[0]),
		["src/features/bank/shared/bank-network.ts"],
	);
});

test("a component has a story, unless it says why not", () => {
	const [files, read] = sources({
		"src/features/shop/client/shop-panel.tsx": "",
		"src/features/shop/client/shop-panel.story.tsx": "",
		"src/features/shop/client/price-tag.tsx": "",
		"src/app/client/app.tsx": "",
		"src/features/shop/client/shop-controller.tsx": "",
		"src/features/shop/client/frame-wrapper.tsx": "// no-story: it only passes its children through",
	});
	assert.deepEqual(
		storyErrors(files, read).map((error) => error.split(":")[0]),
		["src/features/shop/client/price-tag.tsx"],
	);
});

test("runtime packages come from a scope the game mounts", () => {
	const mounted = mountedScopes([
		'{ "@rbxts": { "$path": "node_modules/@rbxts" }, "@quenty": { "$path": "node_modules/@quenty" } }',
	]);
	const json = JSON.stringify({
		dependencies: { "@rbxts/react": "1", "@quenty/loader": "1", "@flamework/core": "1", lodash: "4" },
	});
	assert.deepEqual(
		packageErrors(json, mounted).map((error) => error.split(" ")[1]),
		["@flamework/core", "lodash"],
	);
	assert.match(packageErrors(json, mounted)[0] ?? "", /mount @flamework/);
});

test("a package whose state the game shares, in two versions, is an error; a stateless one isn't", () => {
	const lockfile = [
		"packages:",
		"",
		"  '@rbxts/ripple@0.9.3':",
		"  '@rbxts/ripple@0.10.2':",
		"  '@rbxts/react@17.3.13-ts.1':",
		"  '@rbxts-js/shared@17.3.7-ts.1':",
		"  '@rbxts/t@2.2.1':",
		"  '@rbxts/t@3.2.1':",
		"  '@rbxts-js/shared@17.3.13-ts.2':",
		"",
		"snapshots:",
		"",
		"  '@rbxts/react@17.3.13-ts.1':",
		"  '@rbxts/pretty-react-hooks@0.6.4(@rbxts/react@17.3.13-ts.1)':",
	].join("\n");
	assert.deepEqual(
		duplicateErrors(lockfile).map((error) => error.split(" is installed")[0]),
		["pnpm-lock.yaml: @rbxts/ripple"],
	);
});
