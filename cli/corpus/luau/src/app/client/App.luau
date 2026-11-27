local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Vide = require(ReplicatedStorage.Packages.Vide)

local Counter = require(script.Parent.Parent.features.dailyreward.Counter)
local DailyRewardController = require(script.Parent.Parent.features.dailyreward.DailyRewardController)

local create = Vide.create

local function App()
	local secondsLeft = Vide.source(DailyRewardController.getSecondsLeft())
	Vide.cleanup(DailyRewardController.subscribe(function(seconds)
		secondsLeft(seconds)
	end))
	return create("ScreenGui")({
		Name = "App",
		ResetOnSpawn = false,
		Counter({ count = secondsLeft }),
	})
end

return App
