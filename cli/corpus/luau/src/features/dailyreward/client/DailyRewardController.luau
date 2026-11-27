local ReplicatedStorage = game:GetService("ReplicatedStorage")

local DailyRewardNetwork = require(ReplicatedStorage.Shared.features.dailyreward.DailyRewardNetwork)
local DailyReward = require(script.Parent.DailyReward)

type DailyReward = DailyReward.DailyReward

local DailyRewardController = {}

local reward: DailyReward = { status = "loading" }
local listeners: { [(DailyReward) -> ()]: true } = {}

function DailyRewardController.start()
	DailyRewardNetwork.changed:connect(function(secondsLeft)
		reward = DailyReward.fromSecondsLeft(secondsLeft)
		for listener in listeners do
			listener(reward)
		end
	end)
	DailyRewardNetwork.request:fire()
end

function DailyRewardController.getReward(): DailyReward
	return reward
end

function DailyRewardController.subscribe(listener: (DailyReward) -> ()): () -> ()
	listeners[listener] = true
	return function()
		listeners[listener] = nil
	end
end

function DailyRewardController.claim()
	DailyRewardNetwork.claim:fire()
end

return DailyRewardController
