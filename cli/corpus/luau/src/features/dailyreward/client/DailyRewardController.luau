local ReplicatedStorage = game:GetService("ReplicatedStorage")

local DailyRewardNetwork = require(ReplicatedStorage.Shared.features.dailyreward.DailyRewardNetwork)

local DailyRewardController = {}

local secondsLeft = -1
local listeners: { [(number) -> ()]: true } = {}

function DailyRewardController.start()
	DailyRewardNetwork.changed:connect(function(value)
		secondsLeft = value
		for listener in listeners do
			listener(value)
		end
	end)
	DailyRewardNetwork.request:fire()
end

function DailyRewardController.getSecondsLeft(): number
	return secondsLeft
end

function DailyRewardController.subscribe(listener: (number) -> ()): () -> ()
	listeners[listener] = true
	return function()
		listeners[listener] = nil
	end
end

function DailyRewardController.claim()
	DailyRewardNetwork.claim:fire()
end

return DailyRewardController
