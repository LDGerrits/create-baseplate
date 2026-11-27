local ReplicatedStorage = game:GetService("ReplicatedStorage")

local JestGlobals = require(ReplicatedStorage.DevPackages.JestGlobals)
local describe, expect, it = JestGlobals.describe, JestGlobals.expect, JestGlobals.it

local LeaderboardService = require(script.Parent.LeaderboardService)

describe("LeaderboardService.top", function()
	it("keeps the highest scores, highest first", function()
		local top = LeaderboardService.top({
			{ key = "a", value = 1 },
			{ key = "b", value = 3 },
			{ key = "c", value = 2 },
		}, 2)
		expect(top[1].key).toBe("b")
		expect(top[2].key).toBe("c")
		expect(#top).toBe(2)
	end)
end)
