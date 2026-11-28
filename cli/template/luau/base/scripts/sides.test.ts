import assert from "node:assert/strict";
import { test } from "node:test";
import { sideErrors } from "./sides.ts";

const server = (code: string) => sideErrors("src/features/shop/server/ShopService.luau", "server", code);
const client = (code: string) => sideErrors("src/app/client/Start.luau", "client", code);
const shared = (code: string) => sideErrors("src/features/shop/shared/ShopNetwork.luau", "shared", code);

test("refuses client-only APIs in server code, whichever way it reaches them", () => {
	for (const code of [
		`local UserInputService = game:GetService("UserInputService")`,
		`local c = game:GetService('ContextActionService')`,
		`local g = game.GuiService`,
		`local p = Players.LocalPlayer`,
		`local p = players.LocalPlayer`,
		`RunService.RenderStepped:Connect(function() end)`,
		`RunService:BindToRenderStep("a", 1, function() end)`,
		`local c = workspace.CurrentCamera`,
		`StarterGui:SetCore("ResetButtonCallback", false)`,
	]) {
		const errors = server(`-- a\n${code}`);
		assert.equal(errors.length, 1, code);
		assert.match(
			errors[0] ?? "",
			/^src\/features\/shop\/server\/ShopService\.luau:2: .* runs only on the client: move this into client\/ and send the result through a remote\.$/,
		);
	}
});

test("refuses server-only APIs in client code", () => {
	for (const code of [
		`local DataStoreService = game:GetService("DataStoreService")`,
		`local m = game:GetService("MessagingService")`,
		`local s = game:GetService("MemoryStoreService")`,
		`local s = game.ServerStorage`,
		`local s = game:GetService("ServerScriptService")`,
		`HttpService:RequestAsync({ Url = "https://example.com" })`,
		`HttpService:GetAsync("https://example.com")`,
		`BadgeService:AwardBadge(1, 2)`,
		`BadgeService:AwardBadgeAsync(1, 2)`,
		`MarketplaceService.ProcessReceipt = function() end`,
		`part:SetNetworkOwner(nil)`,
	]) {
		const errors = client(code);
		assert.equal(errors.length, 1, code);
		assert.match(
			errors[0] ?? "",
			/runs only on the server: move this into server\/ and have the client ask for it through a remote\.$/,
		);
	}
});

test("accepts what works on that side", () => {
	assert.deepEqual(
		server(`local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local ServerScriptService = game:GetService("ServerScriptService")
HttpService:JSONEncode({})
MarketplaceService.ProcessReceipt = function() return 1 end
StarterGui:FindFirstChild("Gui")
store:GetAsync("key")`),
		[],
	);
	assert.deepEqual(
		client(`local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local player = Players.LocalPlayer
HttpService:JSONDecode("{}")
BadgeService:UserHasBadgeAsync(1, 2)
local camera = workspace.CurrentCamera`),
		[],
	);
});

test("ignores comments, and lets a line say its call is guarded", () => {
	assert.deepEqual(server(`-- Players.LocalPlayer is nil here\n--[[ UserInputService\nGuiService ]]\nlocal a = 1`), []);
	assert.deepEqual(shared(`local p = Players.LocalPlayer -- guarded: only when RunService:IsClient()`), []);
	assert.equal(shared(`local p = Players.LocalPlayer -- guarded:`).length, 1);
	assert.equal(
		shared(`local p = Players.LocalPlayer\nlocal q = Players.LocalPlayer -- guarded: client only`).length,
		1,
	);
});

test("applies both lists to shared code, with the way out in the message", () => {
	assert.match(
		shared(`local p = Players.LocalPlayer`)[0] ?? "",
		/:1: LocalPlayer runs only on the client, and shared\/ runs on both sides.*`-- guarded: <why>`/,
	);
	assert.match(
		shared(`local d = game:GetService("DataStoreService")`)[0] ?? "",
		/DataStoreService runs only on the server, and shared\/ runs on both sides/,
	);
});
