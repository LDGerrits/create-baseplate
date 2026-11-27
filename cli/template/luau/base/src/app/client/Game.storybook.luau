local storyRoots: { Instance } = { script.Parent }
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
