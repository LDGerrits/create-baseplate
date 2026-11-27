-- ree never fires `Touched`; the engine spec beside the service covers the touch.

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
		bootServer()
		local coins = game:GetService("CollectionService"):GetTagged("Coin")
		assert(#coins == 1, `expected one coin in the map, got {#coins}`)
	end,

	Client = function()
		local player = game:GetService("Players").LocalPlayer
		local counter = waitFor("the coin counter", function()
			local leaderstats = player:FindFirstChild("leaderstats")
			return leaderstats and leaderstats:FindFirstChild("Coins")
		end)
		assert(counter.Value == 0, `expected 0, got {counter.Value}`)
		print("@done")
	end,
}
