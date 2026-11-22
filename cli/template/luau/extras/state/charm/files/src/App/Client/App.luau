-- The root of the player's UI.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local React = require(ReplicatedStorage.Packages.React)
local ReactCharm = require(ReplicatedStorage.Packages.ReactCharm)

local Features = script.Parent.Parent.Features
local ClickerButton = require(Features.Clicker.ClickerButton)
local ClickerController = require(Features.Clicker.ClickerController)

local function App()
	local clicks = ReactCharm.useSignalState(ClickerController.clicks)

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
