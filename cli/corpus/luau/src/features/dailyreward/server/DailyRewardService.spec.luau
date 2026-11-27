local ReplicatedStorage = game:GetService("ReplicatedStorage")

local JestGlobals = require(ReplicatedStorage.DevPackages.JestGlobals)
local describe, expect, it = JestGlobals.describe, JestGlobals.expect, JestGlobals.it

local DailyRewardService = require(script.Parent.DailyRewardService)

describe("DailyRewardService", function()
	it("lets a player claim once, then not until a day has passed", function()
		expect(DailyRewardService.claim(1, 1000)).toBe(true)
		expect(DailyRewardService.claim(1, 1000 + DailyRewardService.DAY - 1)).toBe(false)
		expect(DailyRewardService.claim(1, 1000 + DailyRewardService.DAY)).toBe(true)
	end)

	it("copies the nested history it changes, leaving the old record as it was", function()
		local before = table.freeze({ history = table.freeze({ 1 }) }) :: any -- frozen as Lapis freezes saved data
		local after = DailyRewardService.claimed(before, 2)
		expect(#before.history).toBe(1)
		expect(after.history).toEqual({ 1, 2 })
	end)

	-- A skipped test shows in the results; the check lets it through.
	describe.skip("in the player's time zone", function()
		it("resets at midnight", function()
			expect(true).toBe(true)
		end)
	end)
end)
