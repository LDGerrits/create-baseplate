local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")

local JestGlobals = require(ReplicatedStorage.DevPackages.JestGlobals)
local beforeEach = JestGlobals.beforeEach
local describe = JestGlobals.describe
local expect = JestGlobals.expect
local it = JestGlobals.it
local jest = JestGlobals.jest

-- A table stands in for a Player: no test can create a real one.
local function fakePlayer(userId: number): Player
	local fake: any = { UserId = userId, FindFirstChild = function() end }
	return fake
end

describe("CoinPickupService", function()
	local CoinPickupService
	local CurrencyService

	-- A fresh copy of the services for each test, so state doesn't carry over.
	beforeEach(function()
		jest.resetModules()
		CoinPickupService = require(script.Parent.CoinPickupService)
		CurrencyService = require(ServerScriptService.game.currency.CurrencyService)
	end)

	it("gives 10 coins for the coin", function()
		expect(CoinPickupService.collect(fakePlayer(1), 100)).toBe(true)
		expect(CurrencyService.get(1)).toBe(10)
	end)

	it("gives nothing to anyone until the coin respawns", function()
		CoinPickupService.collect(fakePlayer(1), 100)

		expect(CoinPickupService.collect(fakePlayer(1), 104.9)).toBe(false)
		expect(CoinPickupService.collect(fakePlayer(2), 104.9)).toBe(false)
		expect(CurrencyService.get(1)).toBe(10)
		expect(CurrencyService.get(2)).toBe(0)
	end)

	it("can be taken again after 5 seconds", function()
		CoinPickupService.collect(fakePlayer(1), 100)

		expect(CoinPickupService.collect(fakePlayer(1), 105)).toBe(true)
		expect(CurrencyService.get(1)).toBe(20)
	end)
end)
