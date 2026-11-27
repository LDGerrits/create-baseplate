local ReplicatedStorage = game:GetService("ReplicatedStorage")

local UILabs = require(ReplicatedStorage.DevPackages.UILabs)
local Vide = require(ReplicatedStorage.Packages.Vide)

local Counter = require(script.Parent.Counter)

return UILabs.CreateVideStory({
	vide = Vide,
	controls = { count = UILabs.Number(0, 0) },
}, function(props)
	return Counter({ count = props.controls.count })
end)
