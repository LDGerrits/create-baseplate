-- `mise run ui` renders this with rur; in Studio, the UI Labs plugin shows it with its controls.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local React = require(ReplicatedStorage.Packages.React)
local ReactRoblox = require(ReplicatedStorage.Packages.ReactRoblox)
local UILabs = require(ReplicatedStorage.DevPackages.UILabs)

local ClickerButton = require(script.Parent.ClickerButton)

return UILabs.CreateReactStory({
	react = React,
	reactRoblox = ReactRoblox,
	controls = { clicks = UILabs.Number(0, 0) },
}, function(props)
	return React.createElement(ClickerButton, {
		clicks = props.controls.clicks,
		onClick = function()
			print("clicked")
		end,
	})
end)
