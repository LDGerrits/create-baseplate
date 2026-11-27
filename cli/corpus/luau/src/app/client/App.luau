-- The UI root: a ScreenGui holding the screens, which a story couldn't show, so it has none.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local React = require(ReplicatedStorage.Packages.React)

local Counter = require(script.Parent.Parent.features.dailyreward.Counter)
local DailyRewardController = require(script.Parent.Parent.features.dailyreward.DailyRewardController)

local function App()
	-- React 17 has no useSyncExternalStore: take the controller's value and subscribe in an effect.
	local secondsLeft, setSecondsLeft = React.useState(DailyRewardController.getSecondsLeft())
	React.useEffect(function()
		setSecondsLeft(DailyRewardController.getSecondsLeft())
		return DailyRewardController.subscribe(setSecondsLeft)
	end, {})
	return React.createElement("ScreenGui", { ResetOnSpawn = false }, {
		DailyReward = React.createElement(Counter, { count = secondsLeft }),
	})
end

return App
