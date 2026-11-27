-- datastore: a leaderboard's ordered store, not player data
local DataStoreService = game:GetService("DataStoreService")

local LeaderboardService = {}

export type Entry = { key: string, value: number }

function LeaderboardService.top(entries: { Entry }, size: number): { Entry }
	local sorted = table.clone(entries)
	table.sort(sorted, function(a, b)
		return a.value > b.value
	end)
	return { table.unpack(sorted, 1, math.min(size, #sorted)) }
end

function LeaderboardService.recordWin(userId: number)
	DataStoreService:GetOrderedDataStore("Wins"):IncrementAsync(tostring(userId), 1)
end

function LeaderboardService.start() end

return LeaderboardService
