local ReplicatedStorage = game:GetService("ReplicatedStorage")

local JestGlobals = require(ReplicatedStorage.DevPackages.JestGlobals)
local describe = JestGlobals.describe
local expect = JestGlobals.expect
local it = JestGlobals.it

local RateLimit = require(script.Parent.RateLimit)

describe("RateLimit.perSecond", function()
	it("lets a second's worth through at once, then refuses", function()
		local limit = RateLimit.perSecond(3)
		local results = {}
		for _ = 1, 4 do
			table.insert(results, limit:allow(1, 0))
		end
		expect(results).toEqual({ true, true, true, false })
	end)

	it("lets calls through again as time passes", function()
		local limit = RateLimit.perSecond(2)
		limit:allow(1, 0)
		limit:allow(1, 0)
		expect(limit:allow(1, 0.25)).toBe(false)
		expect(limit:allow(1, 0.5)).toBe(true)
	end)

	it("keeps each player's limit apart", function()
		local limit = RateLimit.perSecond(1)
		limit:allow(1, 0)
		expect(limit:allow(1, 0)).toBe(false)
		expect(limit:allow(2, 0)).toBe(true)
	end)

	it("lets one call through every two seconds at half a call a second", function()
		local limit = RateLimit.perSecond(0.5)
		expect(limit:allow(1, 0)).toBe(true)
		expect(limit:allow(1, 1)).toBe(false)
		expect(limit:allow(1, 2)).toBe(true)
		expect(limit:allow(1, 2.5)).toBe(false)
	end)

	it("starts a player over once forgotten", function()
		local limit = RateLimit.perSecond(1)
		limit:allow(1, 0)
		limit:forget(1)
		expect(limit:allow(1, 0)).toBe(true)
	end)
end)

describe("RateLimit.trustsClient", function()
	it("lets every call through", function()
		local limit = RateLimit.trustsClient("a test")
		for _ = 1, 100 do
			expect(limit:allow(1, 0)).toBe(true)
		end
	end)

	it("wants a reason", function()
		expect(function()
			RateLimit.trustsClient("")
		end).toThrow("say why")
	end)
end)
