-- Counts each round down and tells every player each whole second, checked every frame.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local RoundTimerNetwork = require(ReplicatedStorage.Shared.features.roundtimer.RoundTimerNetwork)

local RoundTimerService = {}

RoundTimerService.ROUND_SECONDS = 120

local left = RoundTimerService.ROUND_SECONDS
local shown = RoundTimerService.ROUND_SECONDS

-- Advances the round by `deltaTime`; returns the whole seconds left when they changed.
function RoundTimerService.step(deltaTime: number): number?
	left -= deltaTime
	if left <= 0 then
		left += RoundTimerService.ROUND_SECONDS
	end
	local whole = math.ceil(left)
	if whole == shown then
		return nil
	end
	shown = whole
	return whole
end

-- Main.server.luau calls this once, after every service has loaded.
function RoundTimerService.start()
	RunService.Heartbeat:Connect(function(deltaTime)
		local whole = RoundTimerService.step(deltaTime)
		if whole then
			RoundTimerNetwork.tick:fireAll(whole)
		end
	end)
end

return RoundTimerService
