-- Asks the server how long until the next claim, and keeps its latest answer for the UI.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local DailyRewardNetwork = require(ReplicatedStorage.Shared.features.dailyreward.DailyRewardNetwork)

local DailyRewardController = {}

local secondsLeft = -1
local listeners: { [(number) -> ()]: true } = {}

-- Start.luau calls this once, after every controller has loaded.
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

-- Calls `listener` with each new answer; returns what stops it.
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
