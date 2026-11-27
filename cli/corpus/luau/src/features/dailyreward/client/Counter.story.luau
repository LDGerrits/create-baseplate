local ReplicatedStorage = game:GetService("ReplicatedStorage")

local UILabs = require(ReplicatedStorage.DevPackages.UILabs)
local Vide = require(ReplicatedStorage.Packages.Vide)

local Counter = require(script.Parent.Counter)
local DailyReward = require(script.Parent.DailyReward)

return UILabs.CreateVideStory({
	vide = Vide,
	controls = { secondsLeft = UILabs.Number(0, 0) },
}, function(props)
	return Counter({
		reward = function()
			return DailyReward.fromSecondsLeft(props.controls.secondsLeft())
		end,
	})
end)
