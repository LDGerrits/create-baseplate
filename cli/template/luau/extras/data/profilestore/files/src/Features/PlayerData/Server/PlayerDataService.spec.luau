local ReplicatedStorage = game:GetService("ReplicatedStorage")

local JestGlobals = require(ReplicatedStorage.DevPackages.JestGlobals)
local beforeAll = JestGlobals.beforeAll
local describe = JestGlobals.describe
local expect = JestGlobals.expect
local it = JestGlobals.it

local PlayerData = require(script.Parent.PlayerData)
local PlayerDataService = require(script.Parent.PlayerDataService)

-- The service is loaded once, not afresh for each test with jest.resetModules: ProfileStore starts a
-- thread when it loads, which Jest stops with an error when it runs on after the test that loaded it.
-- So each test uses its own player, whose profile no other test touches.
describe("PlayerDataService", function()
	beforeAll(function()
		PlayerDataService.useMockStore()
	end)

	it("starts a new player with the defaults", function()
		expect(PlayerDataService.load(1)).toBe(true)
		expect(PlayerDataService.get(1)).toEqual(PlayerData.DEFAULT)
	end)

	it("keeps an update after the player leaves and rejoins", function()
		PlayerDataService.load(2)
		PlayerDataService.update(2, function(data)
			local changed = table.clone(data)
			changed.coins += 5
			return changed
		end)
		PlayerDataService.release(2)
		expect(PlayerDataService.get(2)).toBeNil()
		PlayerDataService.load(2)
		expect(PlayerDataService.get(2)).toEqual({ coins = 5 })
	end)

	it("changes nothing for a player who isn't loaded", function()
		expect(PlayerDataService.update(3, function(data)
			return data
		end)).toBe(false)
	end)
end)
