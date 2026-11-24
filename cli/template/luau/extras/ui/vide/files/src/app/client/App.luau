-- The root of the player's UI.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Vide = require(ReplicatedStorage.Packages.Vide)

local features = script.Parent.Parent.features
local ClickerButton = require(features.clicker.ClickerButton)
local ClickerController = require(features.clicker.ClickerController)

local create = Vide.create

local function App()
	local clicks = Vide.source(ClickerController.getClicks())
	Vide.cleanup(ClickerController.subscribe(function(count)
		clicks(count)
	end))

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
