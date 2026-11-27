-- End-to-end: the daily-reward feature's requests through the real server and remotes, the way a
-- player's client sends them. Test each request a client sends here; `scripts/test.ts` runs every
-- file in this folder.

-- A harness replaces the place's own boot, so start the server's entry script ourselves.
local function bootServer()
	local main = game:GetService("ServerScriptService").app.main
	local run = assert(loadstring(main.Source, "=" .. main:GetFullName()))
	setfenv(run, setmetatable({ script = main }, { __index = getfenv(0) }))
	task.spawn(run)
end

-- Wait for a condition rather than a fixed time: fixed waits make tests slow and flaky.
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

-- Flamework creates the feature's remotes as the server starts, in a folder named after its network file.
local NETWORK = "/daily-reward-network@DailyRewardNetwork"

local function remote(name: string): RemoteEvent
	return waitFor(`the daily-reward {name} remote`, function()
		for _, folder in game:GetService("ReplicatedStorage"):GetChildren() do
			if folder:IsA("Folder") and string.find(folder.Name, NETWORK, 1, true) then
				local found = folder:FindFirstChild(name)
				if found and found:IsA("RemoteEvent") then
					return found
				end
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
