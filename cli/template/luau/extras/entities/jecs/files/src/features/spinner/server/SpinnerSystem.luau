-- The spinner's components and the system that turns them. The system uses only the world and the
-- time, so a spec can run it on its own world.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Jecs = require(ReplicatedStorage.Packages.Jecs)

local SpinnerSystem = {}

-- The part an entity moves.
SpinnerSystem.Part = Jecs.component() :: Jecs.Entity<BasePart>
-- How fast an entity spins, in radians per second.
SpinnerSystem.Spin = Jecs.component() :: Jecs.Entity<number>

-- Turns every entity that has a Part and a Spin by its speed times `deltaTime`, in seconds.
function SpinnerSystem.run(world: Jecs.World, deltaTime: number)
	for _, part, speed in world:query(SpinnerSystem.Part, SpinnerSystem.Spin) do
		part.CFrame *= CFrame.Angles(0, speed * deltaTime, 0)
	end
end

return SpinnerSystem
