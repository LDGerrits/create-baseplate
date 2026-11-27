local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Jecs = require(ReplicatedStorage.Packages.Jecs)

local SpinnerSystem = {}

SpinnerSystem.Part = Jecs.component() :: Jecs.Entity<BasePart>
SpinnerSystem.Spin = Jecs.component() :: Jecs.Entity<number>

function SpinnerSystem.run(world: Jecs.World, deltaTime: number)
	for _, part, radiansPerSecond in world:query(SpinnerSystem.Part, SpinnerSystem.Spin) do
		part.CFrame *= CFrame.Angles(0, radiansPerSecond * deltaTime, 0)
	end
end

return SpinnerSystem
