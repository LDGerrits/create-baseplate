-- Gives each player a reward once a day. Clients ask; this service decides, by its own clock.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")

local CurrencyService = require(ServerScriptService.game.currency.CurrencyService)
local DailyRewardNetwork = require(ReplicatedStorage.Shared.features.dailyreward.DailyRewardNetwork)

local DailyRewardService = {}

DailyRewardService.REWARD = 100
DailyRewardService.DAY = 24 * 60 * 60

export type Record = { claimedAt: number?, history: { number } }

local records: { [number]: Record } = {}

-- What a claim at `now` makes of a player's record: a changed copy, its nested history copied too.
function DailyRewardService.claimed(data: Record, now: number): Record
	local copy = table.clone(data)
	copy.history = table.clone(data.history)
	table.insert(copy.history, now)
	copy.claimedAt = now
	return copy
end

function DailyRewardService.secondsLeft(userId: number, now: number?): number
	local record = records[userId]
	if record == nil or record.claimedAt == nil then
		return 0
	end
	return math.max(0, record.claimedAt + DailyRewardService.DAY - (now or os.time()))
end

-- Claims the reward if a day has passed since the last claim.
function DailyRewardService.claim(userId: number, now: number?): boolean
	local at = now or os.time()
	if DailyRewardService.secondsLeft(userId, at) > 0 then
		return false
	end
	records[userId] = DailyRewardService.claimed(records[userId] or { history = {} }, at)
	return true
end

-- Main.server.luau calls this once, after every service has loaded.
function DailyRewardService.start()
	DailyRewardNetwork.request:connect(function(player: Player)
		DailyRewardNetwork.changed:fire(player, DailyRewardService.secondsLeft(player.UserId))
	end)
	DailyRewardNetwork.claim:connect(function(player: Player)
		if DailyRewardService.claim(player.UserId) then
			CurrencyService.add(player, DailyRewardService.REWARD)
		end
		DailyRewardNetwork.changed:fire(player, DailyRewardService.secondsLeft(player.UserId))
	end)
end

return DailyRewardService
