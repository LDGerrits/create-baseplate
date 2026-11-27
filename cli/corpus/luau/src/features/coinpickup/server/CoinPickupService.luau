local Players = game:GetService("Players")
local ServerScriptService = game:GetService("ServerScriptService")

local CurrencyService = require(ServerScriptService.game.currency.CurrencyService)

local REWARD = 10
local RESPAWN_SECONDS = 5

local CoinPickupService = {}

local availableAt = 0

function CoinPickupService.collect(player: Player, now: number?): boolean
	local time = now or os.clock()
	if time < availableAt then
		return false
	end
	availableAt = time + RESPAWN_SECONDS
	CurrencyService.add(player, REWARD)
	return true
end

local function setShown(coin: BasePart, shown: boolean)
	coin.Transparency = if shown then 0 else 1
	coin.CanTouch = shown
end

function CoinPickupService.start()
	local coin = workspace.Coin
	coin.Touched:Connect(function(hit)
		local character = hit.Parent
		if not character or not character:IsA("Model") then
			return
		end
		local player = Players:GetPlayerFromCharacter(character)
		local humanoid = character:FindFirstChildOfClass("Humanoid")
		if not player or not humanoid or humanoid.Health <= 0 then
			return
		end
		if CoinPickupService.collect(player) then
			setShown(coin, false)
			task.delay(RESPAWN_SECONDS, setShown, coin, true)
		end
	end)
end

return CoinPickupService
