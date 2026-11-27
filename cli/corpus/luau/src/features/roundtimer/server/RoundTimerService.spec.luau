local ReplicatedStorage = game:GetService("ReplicatedStorage")

local JestGlobals = require(ReplicatedStorage.DevPackages.JestGlobals)
local describe, expect, it = JestGlobals.describe, JestGlobals.expect, JestGlobals.it

local RoundTimerService = require(script.Parent.RoundTimerService)

describe("RoundTimerService", function()
	it("reports each whole second once, and starts a new round at zero", function()
		expect(RoundTimerService.step(0.5)).toBe(nil)
		expect(RoundTimerService.step(0.6)).toBe(RoundTimerService.ROUND_SECONDS - 1)
		expect(RoundTimerService.step(118.9)).toBe(RoundTimerService.ROUND_SECONDS)
	end)
end)
