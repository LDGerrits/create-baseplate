local ReplicatedStorage = game:GetService("ReplicatedStorage")

local JestGlobals = require(ReplicatedStorage.DevPackages.JestGlobals)
local beforeEach = JestGlobals.beforeEach
local describe = JestGlobals.describe
local expect = JestGlobals.expect
local it = JestGlobals.it
local jest = JestGlobals.jest

describe("CoinBadgeService", function()
	local CoinBadgeService

	beforeEach(function()
		jest.resetModules()
		CoinBadgeService = require(script.Parent.CoinBadgeService)
	end)

	it("earns the badge once, at 100 coins", function()
		expect(CoinBadgeService.earn(1, 99)).toBe(false)
		expect(CoinBadgeService.earn(1, 100)).toBe(true)
		expect(CoinBadgeService.earn(1, 110)).toBe(false)
	end)
end)
