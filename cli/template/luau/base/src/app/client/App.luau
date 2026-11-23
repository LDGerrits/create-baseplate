-- The root of the player's UI.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local React = require(ReplicatedStorage.Packages.React)

local features = script.Parent.Parent.features
local ClickerButton = require(features.clicker.ClickerButton)
local ClickerController = require(features.clicker.ClickerController)

local function App()
	local clicks, setClicks = React.useState(ClickerController.getClicks())
	React.useEffect(function()
		return ClickerController.subscribe(setClicks)
	end, {})

	return React.createElement("ScreenGui", {
		ResetOnSpawn = false,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	}, {
		ClickerButton = React.createElement(ClickerButton, {
			clicks = clicks,
			onClick = ClickerController.click,
		}),
	})
end

return App
