-- Lists this game's stories in the UI Labs plugin. Every feature's client folder ends up under
-- StarterPlayerScripts.features, beside this script's folder.
local features = script.Parent.Parent:FindFirstChild("features")

return {
	name = "my-game",
	storyRoots = if features then { features } else {},
}
