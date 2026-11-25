-- Lists this game's stories in the UI Labs plugin. The client folders of the features, game systems
-- and platform modules end up under StarterPlayerScripts.features, .game and .platform, beside this
-- script's folder.
local storyRoots = {}
for _, layer in { "features", "game", "platform" } do
	local folder = script.Parent.Parent:FindFirstChild(layer)
	if folder then
		table.insert(storyRoots, folder)
	end
end

return {
	name = "my-game",
	storyRoots = storyRoots,
}
