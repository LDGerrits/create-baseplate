-- ree harness: runs every Jest spec in the game, except `*.engine.spec`, which need the real engine.
-- `scripts/test.ts` runs it; `mise run test:engine` runs all specs in Roblox Studio instead.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

-- `shared` exists only once the game has shared code.
local roots = {
	game:GetService("ServerScriptService"),
	game:GetService("StarterPlayer").StarterPlayerScripts,
}
local shared = ReplicatedStorage:FindFirstChild("shared")
if shared then
	table.insert(roots, shared)
end

local CONFIG = [[return {
	testMatch = { "**/*.spec" },
	testPathIgnorePatterns = { "\\.engine\\.spec$" },
}]]

-- `filter` holds the testPathPattern and testNamePattern that `mise run test -- ...` was given, if any.
return function(filter)
	for _, root in roots do
		local config = Instance.new("ModuleScript")
		config.Name = "jest.config"
		config.Source = CONFIG
		config.Parent = root
	end

	local Jest = require(ReplicatedStorage.rbxts_include.node_modules["@rbxts-js"].Jest)
	local ok, result = Jest.runCLI(ReplicatedStorage, {
		ci = true,
		verbose = true,
		passWithNoTests = true,
		testPathPattern = filter.testPathPattern,
		testNamePattern = filter.testNamePattern,
	}, roots):await()
	if not ok then
		error(tostring(result), 0)
	end

	local results = result.results
	print(
		("@jest %d passed, %d failed, %d total"):format(
			results.numPassedTests,
			results.numFailedTests,
			results.numTotalTests
		)
	)
	if not results.success then
		error("Jest: tests failed", 0)
	end
end
