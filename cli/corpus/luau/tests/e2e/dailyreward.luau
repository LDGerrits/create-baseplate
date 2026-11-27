local function bootServer()
	local main = game:GetService("ServerScriptService").app.Main
	local run = assert(loadstring(main.Source, "=" .. main:GetFullName()))
	setfenv(run, setmetatable({ script = main }, { __index = getfenv(0) }))
	task.spawn(run)
end

local function waitFor<T>(what: string, check: () -> T?, seconds: number?): T
	local deadline = os.clock() + (seconds or 5)
	while os.clock() < deadline do
		local value = check()
		if value then
			return value
		end
		task.wait()
	end
	error(`timed out waiting for {what}`)
end

-- The server creates the remotes as its services load; Remo names each after its namespace.
local function remote(name: string): RemoteEvent
	return waitFor(`the dailyReward.{name} remote`, function()
		for _, descendant in game:GetService("ReplicatedStorage"):GetDescendants() do
			if descendant.Name == `dailyReward.{name}` and descendant:IsA("RemoteEvent") then
				return descendant
			end
		end
		return nil
	end)
end

return {
	Server = function()
		bootServer()
	end,

	Client = function()
		local values = {}
		remote("changed").OnClientEvent:Connect(function(value)
			table.insert(values, value)
		end)
		remote("request"):FireServer()
		waitFor("the server's answer", function()
			return #values >= 1
		end)
		assert(values[1] == 0, `expected 0, got {values[1]}`)
		print("@done")
	end,
}
