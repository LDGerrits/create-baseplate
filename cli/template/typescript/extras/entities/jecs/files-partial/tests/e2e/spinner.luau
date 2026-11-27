local function bootServer()
	local main = game:GetService("ServerScriptService").app.main
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

return {
	Server = function()
		local spinner = Instance.new("Part")
		spinner.Name = "Spinner"
		spinner.Anchored = true
		spinner.Position = Vector3.new(0, 6, -16)
		spinner.Parent = workspace
		game:GetService("CollectionService"):AddTag(spinner, "Spinner")
		bootServer()
		local start = spinner.CFrame.LookVector
		waitFor("the spinner to turn", function()
			return spinner.CFrame.LookVector:Dot(start) < 0.99
		end)
		assert((spinner.Position - Vector3.new(0, 6, -16)).Magnitude < 0.01, "the spinner turned in place")
		print("@done")
	end,
	Client = function() end,
}
