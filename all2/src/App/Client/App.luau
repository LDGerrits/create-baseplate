-- The root of the player's UI.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Vide = require(ReplicatedStorage.Packages.Vide)
local VideCharm = require(ReplicatedStorage.Packages.VideCharm)

local Features = script.Parent.Parent.Features
local ClickerButton = require(Features.Clicker.ClickerButton)
local ClickerController = require(Features.Clicker.ClickerController)

local create = Vide.create

local function App()
	local clicks = VideCharm.useSignalState(ClickerController.clicks)

	return create("ScreenGui")({
		ResetOnSpawn = false,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,

		ClickerButton({
			clicks = clicks,
			onClick = ClickerController.click,
		}),
	})
end

return App
