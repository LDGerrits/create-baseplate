-- End-to-end: the real server boots, and the part tagged Spinner in the world turns.
-- `scripts/test.ts` runs every file here.

-- A harness replaces the place's own boot, so start the server's entry script ourselves.
local function bootServer()
	local main = game:GetService("ServerScriptService").App.Main
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

return {
	Server = function()
		bootServer()
		local spinner = workspace:WaitForChild("Spinner") :: BasePart
		local start = spinner.CFrame.LookVector
		waitFor("the spinner to turn", function()
			return spinner.CFrame.LookVector:Dot(start) < 0.99
		end)
		assert((spinner.Position - Vector3.new(0, 6, -16)).Magnitude < 0.01, "the spinner turned in place")
		print("@done")
	end,
	Client = function() end,
}
