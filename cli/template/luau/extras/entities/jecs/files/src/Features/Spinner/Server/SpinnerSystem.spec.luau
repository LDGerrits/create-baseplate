local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Jecs = require(ReplicatedStorage.Packages.Jecs)
local JestGlobals = require(ReplicatedStorage.DevPackages.JestGlobals)
local SpinnerSystem = require(script.Parent.SpinnerSystem)
local describe = JestGlobals.describe
local expect = JestGlobals.expect
local it = JestGlobals.it

describe("SpinnerSystem", function()
	it("turns a spinning part by its speed times the time", function()
		local world = Jecs.world()
		local part = Instance.new("Part")
		local entity = world:entity()
		world:set(entity, SpinnerSystem.Part, part)
		world:set(entity, SpinnerSystem.Spin, math.pi)

		SpinnerSystem.run(world, 0.5)

		-- A quarter turn about the up axis: looking along -Z becomes looking along -X.
		expect(part.CFrame.LookVector.X).toBeCloseTo(-1)
	end)

	it("leaves a part without a speed alone", function()
		local world = Jecs.world()
		local part = Instance.new("Part")
		world:set(world:entity(), SpinnerSystem.Part, part)

		SpinnerSystem.run(world, 1)

		expect(part.CFrame.LookVector.Z).toBeCloseTo(-1)
	end)
end)
