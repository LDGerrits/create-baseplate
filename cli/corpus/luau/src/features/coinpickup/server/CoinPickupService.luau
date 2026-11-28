local CollectionService = game:GetService("CollectionService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")

local Janitor = require(ReplicatedStorage.Packages.Janitor)
local CurrencyService = require(ServerScriptService.game.currency.CurrencyService)

local COIN_TAG = "Coin"
local REWARD = 10
local RESPAWN_SECONDS = 5

local CoinPickupService = {}

local availableAt: { [Instance]: number } = {}
local janitors: { [Instance]: Janitor.Janitor } = {}

function CoinPickupService.collect(coin: Instance, player: Player, now: number?): boolean
	local time = now or os.clock()
	if time < (availableAt[coin] or 0) then
		return false
	end
	availableAt[coin] = time + RESPAWN_SECONDS
	CurrencyService.add(player, REWARD)
	return true
end

local function setShown(coin: BasePart, shown: boolean)
	coin.Transparency = if shown then 0 else 1
	coin.CanTouch = shown
end

local function watch(coin: Instance)
	if not coin:IsA("BasePart") then
		return
	end
	local janitor = Janitor.new()
	janitors[coin] = janitor
	janitor:Add(function()
		availableAt[coin] = nil
	end, true)
	janitor:Add(
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
			if CoinPickupService.collect(coin, player) then
				setShown(coin, false)
				janitor:Add(task.delay(RESPAWN_SECONDS, setShown, coin, true), true, "respawn")
			end
		end),
		"Disconnect"
	)
end

function CoinPickupService.start()
	CollectionService:GetInstanceAddedSignal(COIN_TAG):Connect(watch)
	CollectionService:GetInstanceRemovedSignal(COIN_TAG):Connect(function(coin)
		local janitor = janitors[coin]
		if janitor then
			janitor:Destroy()
			janitors[coin] = nil
		end
	end)
	for _, coin in CollectionService:GetTagged(COIN_TAG) do
		watch(coin)
	end
end

return CoinPickupService
