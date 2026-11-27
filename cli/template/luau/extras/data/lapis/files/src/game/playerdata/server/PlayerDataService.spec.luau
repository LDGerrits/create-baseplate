local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local JestGlobals = require(ReplicatedStorage.DevPackages.JestGlobals)
local beforeEach = JestGlobals.beforeEach
local describe = JestGlobals.describe
local expect = JestGlobals.expect
local it = JestGlobals.it

local PlayerData = require(script.Parent.PlayerData)
local PlayerDataService = require(script.Parent.PlayerDataService)

-- Lapis and its mock DataStore move only on RunService.PostSimulation, which fires only while physics
-- runs. It does in ree, Studio's play mode and a live server, but not in an Open Cloud execution
-- session (`mise run test:engine` in CI), where a load would wait forever; there these skip.
local function whileSimulating(name: string, tests: () -> ())
	if RunService:IsRunning() then
		describe(name, tests)
	else
		describe.skip(name, tests)
	end
end

describe("PlayerDataService", function()
	local collections = 0
	beforeEach(function()
		collections += 1
		PlayerDataService.useMockCollection(`Test_{collections}`)
	end)

	whileSimulating("with data loaded", function()
		it("starts a new player with the defaults", function()
			expect(PlayerDataService.load(1)).toBe(true)
			expect(PlayerDataService.get(1)).toEqual(PlayerData.DEFAULT)
		end)

		it("keeps an update after the player leaves and rejoins", function()
			PlayerDataService.load(1)
			PlayerDataService.update(1, function(data)
				local changed = table.clone(data)
				changed.coins += 5
				return changed
			end)
			PlayerDataService.release(1)
			expect(PlayerDataService.get(1)).toBeNil()
			PlayerDataService.load(1)
			expect(PlayerDataService.get(1)).toEqual({ coins = 5 })
		end)
	end)

	it("changes nothing for a player who isn't loaded", function()
		expect(PlayerDataService.update(2, function(data)
			return data
		end)).toBe(false)
	end)
end)
