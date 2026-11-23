-- `mise run ui` renders this with rur; in Studio, the UI Labs plugin shows it with its controls.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local UILabs = require(ReplicatedStorage.DevPackages.UILabs)
local Vide = require(ReplicatedStorage.Packages.Vide)

local ClickerButton = require(script.Parent.ClickerButton)

return UILabs.CreateVideStory({
	vide = Vide,
	controls = { clicks = UILabs.Number(0, 0) },
}, function(props)
	-- In a Vide story, each control is a source.
	return ClickerButton({
		clicks = props.controls.clicks,
		onClick = function()
			print("clicked")
		end,
	})
end)
