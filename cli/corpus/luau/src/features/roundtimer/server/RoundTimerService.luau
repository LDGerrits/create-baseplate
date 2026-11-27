local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local RoundTimerNetwork = require(ReplicatedStorage.Shared.features.roundtimer.RoundTimerNetwork)

local RoundTimerService = {}

RoundTimerService.ROUND_SECONDS = 120

local left = RoundTimerService.ROUND_SECONDS
local shown = RoundTimerService.ROUND_SECONDS

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

function RoundTimerService.start()
	RunService.Heartbeat:Connect(function(deltaTime)
		local whole = RoundTimerService.step(deltaTime)
		if whole then
			RoundTimerNetwork.tick:fireAll(whole)
		end
	end)
end

return RoundTimerService
