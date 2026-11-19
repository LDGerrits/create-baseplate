-- End-to-end: the real server boots, one player clicks, and the server's cooldown and count come back.
-- ree runs the server and the client together (`--run-context loopback`); `scripts/test.mjs` runs every file here.

-- A harness replaces the place's own boot, so start the server's entry script ourselves.
local function bootServer()
	local main = game:GetService("ServerScriptService").app.main
	local run = assert(loadstring(main.Source, "=" .. main:GetFullName()))
	setfenv(run, setmetatable({ script = main }, { __index = getfenv(0) }))
	task.spawn(run)
end

local function findRemote(name: string): RemoteEvent
	for _, descendant in game:GetService("ReplicatedStorage"):GetDescendants() do
		if descendant.Name == name and descendant:IsA("RemoteEvent") then
			return descendant
		end
	end
	error(`no RemoteEvent named {name}`)
end

return {
	Server = function()
		bootServer()
	end,

	Client = function()
		task.wait(0.5) -- Flamework creates the remotes as the server starts

		local counts = {}
		findRemote("clicksChanged").OnClientEvent:Connect(function(count)
			table.insert(counts, count)
		end)

		local click = findRemote("click")
		click:FireServer()
		click:FireServer() -- inside the cooldown: the server drops it
		task.wait(0.3)
		click:FireServer()
		task.wait(0.3)

		local got = table.concat(counts, ",")
		assert(got == "1,2", `expected counts 1,2, got {got}`)
		print("@done")
	end,
}
