local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Vide = require(ReplicatedStorage.Packages.Vide)

local Counter = require(script.Parent.Parent.features.dailyreward.Counter)
local DailyRewardController = require(script.Parent.Parent.features.dailyreward.DailyRewardController)

local create = Vide.create

local function App()
	local reward = Vide.source(DailyRewardController.getReward())
	Vide.cleanup(DailyRewardController.subscribe(function(value)
		reward(value)
	end))
	return create("ScreenGui")({
		Name = "App",
		ResetOnSpawn = false,
		Counter({ reward = reward }),
	})
end

return App
