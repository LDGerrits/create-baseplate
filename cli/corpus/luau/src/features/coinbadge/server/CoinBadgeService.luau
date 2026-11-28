local BadgeService = game:GetService("BadgeService")
local Players = game:GetService("Players")
local ServerScriptService = game:GetService("ServerScriptService")

local CurrencyService = require(ServerScriptService.game.currency.CurrencyService)

local BADGE_COINS = 100
-- The badge's id on the Creator Hub.
local BADGE_ID = 0

local CoinBadgeService = {}

local earned: { [number]: true } = {}

-- True the first time a player's coins reach the badge's goal.
function CoinBadgeService.earn(userId: number, coins: number): boolean
	if coins < BADGE_COINS or earned[userId] then
		return false
	end
	earned[userId] = true
	return true
end

local function award(player: Player)
	local awarded, problem = pcall(BadgeService.AwardBadgeAsync, BadgeService, player.User, BADGE_ID)
	if not awarded then
		warn(`Couldn't award the coin badge to {player.Name}: {problem}`)
	end
end

function CoinBadgeService.start()
	CurrencyService.changed:Connect(function(player, coins)
		if CoinBadgeService.earn(player.UserId, coins) then
			award(player)
		end
	end)
	Players.PlayerRemoving:Connect(function(player)
		earned[player.UserId] = nil
	end)
end

return CoinBadgeService
