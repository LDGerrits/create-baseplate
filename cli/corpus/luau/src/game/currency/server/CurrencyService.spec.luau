local ReplicatedStorage = game:GetService("ReplicatedStorage")

local JestGlobals = require(ReplicatedStorage.DevPackages.JestGlobals)
local beforeEach = JestGlobals.beforeEach
local describe = JestGlobals.describe
local expect = JestGlobals.expect
local it = JestGlobals.it
local jest = JestGlobals.jest

describe("CurrencyService", function()
	local CurrencyService

	beforeEach(function()
		jest.resetModules()
		CurrencyService = require(script.Parent.CurrencyService)
	end)

	it("starts a player at zero", function()
		expect(CurrencyService.get(1)).toBe(0)
	end)

	it("adds up each player's coins, and shows them in leaderstats", function()
		local player = Instance.new("Folder")
		local leaderstats = Instance.new("Folder")
		leaderstats.Name = "leaderstats"
		leaderstats.Parent = player
		local coins = Instance.new("IntValue")
		coins.Name = "Coins"
		coins.Parent = leaderstats
		local fake: any = {
			UserId = 1,
			FindFirstChild = function(_, name: string)
				return player:FindFirstChild(name)
			end,
		}

		CurrencyService.add(fake, 10)
		CurrencyService.add(fake, 10)

		expect(CurrencyService.get(1)).toBe(20)
		expect(CurrencyService.get(2)).toBe(0)
		expect(coins.Value).toBe(20)
	end)

	it("announces each player's new balance", function()
		local fake: any = { UserId = 1, FindFirstChild = function() end }
		local heard = {}
		CurrencyService.changed:Connect(function(player, coins)
			if player == fake then
				table.insert(heard, coins)
			end
		end)

		CurrencyService.add(fake, 10)
		CurrencyService.add(fake, 5)

		expect(heard).toEqual({ 10, 15 })
	end)
end)
