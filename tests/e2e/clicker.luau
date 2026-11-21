-- End-to-end: the real server boots, one player clicks, and the server's cooldown and count come back.
-- ree runs the server and the client together (`--run-context loopback`); `scripts/test.mjs` runs every file here.

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

-- Flamework creates the remotes as the server starts.
local function remote(name: string): RemoteEvent
	return waitFor(`the {name} remote`, function()
		for _, descendant in game:GetService("ReplicatedStorage"):GetDescendants() do
			if descendant.Name == name and descendant:IsA("RemoteEvent") then
				return descendant
			end
		end
		return nil
	end)
end

local COOLDOWN = 0.1 -- CLICK_COOLDOWN_SECONDS in clicker-service.ts

return {
	Server = function()
		bootServer()
	end,

	Client = function()
		local counts = {}
		remote("clicksChanged").OnClientEvent:Connect(function(count)
			table.insert(counts, count)
		end)

		local click = remote("click")
		click:FireServer()
		click:FireServer() -- inside the cooldown: the server drops it
		waitFor("the first count", function()
			return #counts >= 1
		end)

		task.wait(COOLDOWN)
		click:FireServer()
		waitFor("the second count", function()
			return #counts >= 2
		end)
		task.wait(0.2) -- room for a count the server should have dropped to show up

		local got = table.concat(counts, ",")
		assert(got == "1,2", `expected counts 1,2, got {got}`)
		print("@done")
	end,
}
