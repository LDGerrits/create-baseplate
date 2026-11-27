import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { sideRestrictions } from "./sides.ts";

const eslint = new ESLint({
	cwd: path.resolve(import.meta.dirname, ".."),
	overrideConfigFile: true,
	baseConfig: [
		{
			files: ["**/*.ts"],
			languageOptions: { parser: tseslint.parser as never },
			plugins: { "@typescript-eslint": tseslint.plugin as never },
		},
		...(sideRestrictions(["src", "projects/common/src"]) as never[]),
	],
});

/** The messages ESLint gives code at `file`, which needs no file on disk. */
async function lint(file: string, code: string) {
	const [result] = await eslint.lintText(code, { filePath: path.resolve(import.meta.dirname, "..", file) });
	return result?.messages.map((message) => message.message) ?? [];
}

test("refuses client-only APIs in server code, whichever way it reaches them", async () => {
	const server = "src/features/shop/server/shop-service.ts";
	for (const code of [
		`import { UserInputService } from "@rbxts/services";`,
		`import { ContextActionService as C } from "@rbxts/services";`,
		`const a = game.GetService("GuiService");`,
		`const p = Players.LocalPlayer;`,
		`const p = players.LocalPlayer;`,
		`RunService.RenderStepped.Connect(() => {});`,
		`RunService.BindToRenderStep("a", 1, () => {});`,
		`const c = Workspace.CurrentCamera;`,
		`StarterGui.SetCore("ResetButtonCallback", false);`,
	]) {
		const messages = await lint(server, code);
		assert.equal(messages.length, 1, code);
		assert.match(
			messages[0] ?? "",
			/runs only on the client: move this into client\/ and send the result through a remote/,
		);
	}
});

test("refuses server-only APIs in client code", async () => {
	const client = "src/app/client/main.client.ts";
	for (const code of [
		`import { DataStoreService } from "@rbxts/services";`,
		`import { Workspace, MessagingService } from "@rbxts/services";`,
		`import { MemoryStoreService, ServerStorage, ServerScriptService } from "@rbxts/services";`,
		`const s = game.GetService("ServerStorage");`,
		`HttpService.RequestAsync({ Url: "https://example.com" });`,
		`HttpService.GetAsync("https://example.com");`,
		`BadgeService.AwardBadge(1, 2);`,
		`MarketplaceService.ProcessReceipt = () => 1;`,
		`part.SetNetworkOwner(undefined);`,
	]) {
		const messages = await lint(client, code);
		assert.ok(messages.length >= 1, code);
		assert.match(
			messages[0] ?? "",
			/runs only on the server: move this into server\/ and have the client ask for it through a remote/,
		);
	}
});

test("accepts what works on that side", async () => {
	assert.deepEqual(
		await lint(
			"src/features/shop/server/shop-service.ts",
			`import { Players, HttpService, MarketplaceService, ServerStorage, StarterGui } from "@rbxts/services";
			HttpService.JSONEncode({});
			MarketplaceService.ProcessReceipt = () => 1;
			const folder = StarterGui.FindFirstChild("Gui");
			Players.PlayerAdded.Connect(() => {});
			const players = Players.GetPlayers();
			const stored = ServerStorage.FindFirstChild("a");`,
		),
		[],
	);
	assert.deepEqual(
		await lint(
			"src/app/client/main.client.ts",
			`import { Players, UserInputService, RunService, HttpService, BadgeService, Workspace } from "@rbxts/services";
			import type { DataStoreService } from "@rbxts/services";
			const player = Players.LocalPlayer;
			UserInputService.InputBegan.Connect(() => {});
			RunService.RenderStepped.Connect(() => {});
			HttpService.JSONDecode("{}");
			BadgeService.UserHasBadgeAsync(1, 2);
			const camera = Workspace.CurrentCamera;`,
		),
		[],
	);
});

test("applies both lists to shared code, with the way out in the message", async () => {
	for (const file of ["src/features/shop/shared/shop-network.ts", "projects/common/src/game/data/shared/a.ts"]) {
		const [client, server] = await Promise.all([
			lint(file, `const p = Players.LocalPlayer;`),
			lint(file, `import { DataStoreService } from "@rbxts/services";`),
		]);
		assert.match(client[0] ?? "", /shared\/ runs on both sides.*disable this rule on that line/);
		assert.match(server[0] ?? "", /runs only on the server, and shared\/ runs on both sides/);
	}
});

test("sends player data on the server through a data library, unless the line says why not", async () => {
	const messages = await lint(
		"src/features/leaderboard/server/leaderboard-service.ts",
		`import { DataStoreService } from "@rbxts/services";
		const store = DataStoreService.GetOrderedDataStore("wins");`,
	);
	assert.match(messages[0] ?? "", /data library/);
	assert.deepEqual(
		await lint(
			"src/features/leaderboard/server/leaderboard-service.ts",
			`// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- a leaderboard's ordered store
			import { DataStoreService } from "@rbxts/services";
			const store = DataStoreService.GetOrderedDataStore("wins");`,
		),
		[],
	);
});

test("leaves folders that are not side folders alone", async () => {
	assert.deepEqual(await lint("src/features/shop/notes.ts", `const p = Players.LocalPlayer;`), []);
	assert.deepEqual(await lint("scripts/a.ts", `import { DataStoreService } from "@rbxts/services";`), []);
});
