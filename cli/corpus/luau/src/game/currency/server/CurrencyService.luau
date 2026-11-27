local Players = game:GetService("Players")

local CurrencyService = {}

local balances: { [number]: number } = {}

function CurrencyService.get(userId: number): number
	return balances[userId] or 0
end

local function show(player: Player)
	local leaderstats = player:FindFirstChild("leaderstats")
	local coins = leaderstats and leaderstats:FindFirstChild("Coins")
	if coins and coins:IsA("IntValue") then
		coins.Value = CurrencyService.get(player.UserId)
	end
end

function CurrencyService.add(player: Player, amount: number)
	balances[player.UserId] = CurrencyService.get(player.UserId) + amount
	show(player)
end

local function addLeaderstats(player: Player)
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Parent = leaderstats
	leaderstats.Parent = player
	show(player)
end

function CurrencyService.start()
	Players.PlayerAdded:Connect(addLeaderstats)
	Players.PlayerRemoving:Connect(function(player)
		balances[player.UserId] = nil
	end)
	for _, player in Players:GetPlayers() do
		addLeaderstats(player)
	end
end

return CurrencyService
