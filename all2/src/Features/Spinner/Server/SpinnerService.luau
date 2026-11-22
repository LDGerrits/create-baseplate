-- Keeps a Jecs world of the parts tagged `Spinner` (add the tag in Studio, or in a `.model.json`
-- under world/) and runs the spinner system on it each frame.
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Jecs = require(ReplicatedStorage.Packages.Jecs)
local SpinnerSystem = require(script.Parent.SpinnerSystem)

local SpinnerService = {}

-- How fast spinners turn, in radians per second.
SpinnerService.SPIN_SPEED = math.pi / 2

local world = Jecs.world()
local entities: { [Instance]: Jecs.Entity<nil> } = {}

local function add(instance: Instance)
	if not instance:IsA("BasePart") then
		return
	end
	local entity = world:entity()
	world:set(entity, SpinnerSystem.Part, instance)
	world:set(entity, SpinnerSystem.Spin, SpinnerService.SPIN_SPEED)
	entities[instance] = entity
end

local function remove(instance: Instance)
	local entity = entities[instance]
	if entity ~= nil then
		world:delete(entity)
		entities[instance] = nil
	end
end

-- Main.server.luau calls this once, after every service has loaded.
function SpinnerService.start()
	for _, instance in CollectionService:GetTagged("Spinner") do
		add(instance)
	end
	CollectionService:GetInstanceAddedSignal("Spinner"):Connect(add)
	CollectionService:GetInstanceRemovedSignal("Spinner"):Connect(remove)
	RunService.Heartbeat:Connect(function(deltaTime)
		SpinnerSystem.run(world, deltaTime)
	end)
end

return SpinnerService
