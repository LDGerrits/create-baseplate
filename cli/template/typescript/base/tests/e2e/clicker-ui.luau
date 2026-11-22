-- End-to-end, with the UI: the real server and the client's own start(), as the game runs them.
-- The server changes a player's count, and the label on screen follows: controller, state and UI.

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

return {
	Server = function()
		bootServer()
	end,
	Client = function()
		-- The client can't run a script's source here, so call what main.client runs.
		local scripts = game:GetService("StarterPlayer").StarterPlayerScripts
		require(scripts.app.start).start()

		local gui = game:GetService("Players").LocalPlayer:WaitForChild("PlayerGui")
		local label = waitFor("the clicker button", function()
			local screen = gui:FindFirstChild("ScreenGui")
			return screen and screen:FindFirstChildWhichIsA("TextButton")
		end)
		assert(label.Text == "Clicks: 0", `the button starts at "Clicks: 0", not "{label.Text}"`)

		remote("click"):FireServer()
		waitFor('the label to show "Clicks: 1"', function()
			return label.Text == "Clicks: 1"
		end)
		print("@done")
	end,
}
