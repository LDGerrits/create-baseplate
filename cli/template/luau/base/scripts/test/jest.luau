-- ree harness: runs every Jest spec in the game, except `*.engine.spec`, which need the real engine.
-- `scripts/test.ts` runs it; `mise run test:engine` runs all specs in Roblox Studio instead.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

-- Shared holds code only once a feature has a shared/ folder.
local roots: { Instance } = {
	game:GetService("ServerScriptService"),
	game:GetService("StarterPlayer").StarterPlayerScripts,
}
local shared = ReplicatedStorage:FindFirstChild("Shared")
if shared then
	table.insert(roots, 1, shared)
end

local CONFIG = [[return {
	testMatch = { "**/*.spec" },
	testPathIgnorePatterns = { "\\.engine\\.spec$", "ServerPackages" },
}]]

return function()
	for _, root in roots do
		local config = Instance.new("ModuleScript")
		config.Name = "jest.config"
		config.Source = CONFIG
		config.Parent = root
	end

	local Jest = require(ReplicatedStorage.DevPackages.Jest)
	local ok, result = Jest.runCLI(ReplicatedStorage, { ci = true, verbose = true, passWithNoTests = true }, roots)
		:await()
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
	-- From the counts, which hold whatever Jest's version: jest-lua 3.10 reports `success` inverted,
	-- which scripts/packages.ts fixes in the installed copy.
	if results.numFailedTests > 0 or results.numRuntimeErrorTestSuites > 0 or results.snapshot.failure then
		error("Jest: tests failed", 0)
	end
end
