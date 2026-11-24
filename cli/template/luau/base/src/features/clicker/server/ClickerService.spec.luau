local ReplicatedStorage = game:GetService("ReplicatedStorage")

local JestGlobals = require(ReplicatedStorage.DevPackages.JestGlobals)
local beforeEach = JestGlobals.beforeEach
local describe = JestGlobals.describe
local expect = JestGlobals.expect
local it = JestGlobals.it
local jest = JestGlobals.jest

describe("ClickerService", function()
	local ClickerService

	-- A fresh copy of the service for each test, so counts don't carry over.
	beforeEach(function()
		jest.resetModules()
		ClickerService = require(script.Parent.ClickerService)
	end)

	it("counts a player's clicks", function()
		expect(ClickerService.click(1, 0)).toBe(1)
		expect(ClickerService.click(1, ClickerService.COOLDOWN_SECONDS)).toBe(2)
		expect(ClickerService.getClicks(1)).toBe(2)
	end)

	it("refuses a click inside the cooldown", function()
		ClickerService.click(1, 0)
		expect(ClickerService.click(1, ClickerService.COOLDOWN_SECONDS / 2)).toBeNil()
		expect(ClickerService.getClicks(1)).toBe(1)
	end)

	it("keeps each player's cooldown apart", function()
		ClickerService.click(1, 0)
		expect(ClickerService.click(2, 0)).toBe(1)
	end)
end)
