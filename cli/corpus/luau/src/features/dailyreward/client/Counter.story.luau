local ReplicatedStorage = game:GetService("ReplicatedStorage")

local React = require(ReplicatedStorage.Packages.React)
local ReactRoblox = require(ReplicatedStorage.Packages.ReactRoblox)
local UILabs = require(ReplicatedStorage.DevPackages.UILabs)

local Counter = require(script.Parent.Counter)

return UILabs.CreateReactStory({
	react = React,
	reactRoblox = ReactRoblox,
	controls = { count = UILabs.Number(0, 0) },
}, function(props)
	return React.createElement(Counter, { count = props.controls.count })
end)
