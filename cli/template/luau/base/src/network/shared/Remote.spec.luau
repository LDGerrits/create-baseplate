local ReplicatedStorage = game:GetService("ReplicatedStorage")

local JestGlobals = require(ReplicatedStorage.DevPackages.JestGlobals)
local describe = JestGlobals.describe
local expect = JestGlobals.expect
local it = JestGlobals.it

local Remote = require(script.Parent.Remote)
local t = require(ReplicatedStorage.Packages.t)

describe("Remote", function()
	it("gives each declaration of a name the same remote", function()
		local first = Remote.clientEvent("remoteSpecSame", t.tuple())
		local second = Remote.clientEvent("remoteSpecSame", t.tuple())
		expect(second.instance).toBe(first.instance)
	end)

	it("refuses a name another module already declared", function()
		-- ClickerNetwork declares "click"; a second feature's "click" would share its remote.
		require(ReplicatedStorage.Shared.features.clicker.ClickerNetwork)
		expect(function()
			Remote.clientEvent("click", t.tuple())
		end).toThrow("declared by both")
	end)
end)
