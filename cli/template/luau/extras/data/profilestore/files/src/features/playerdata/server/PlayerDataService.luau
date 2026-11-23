-- Loads each player's saved data when they join and saves it when they leave, with ProfileStore.
-- Other services read and change it through `get` and `update`. Studio uses ProfileStore's mock
-- store, which forgets everything when the server stops.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ServerScriptService = game:GetService("ServerScriptService")

local PlayerData = require(script.Parent.PlayerData)
local ProfileStore = require(ServerScriptService.ServerPackages.ProfileStore)

type PlayerData = PlayerData.PlayerData

local STORE = ProfileStore.New("PlayerData", PlayerData.DEFAULT)
-- The types of this store and the profiles it returns. Written as `ProfileStore.Profile<PlayerData>`,
-- the type checker can't match it to them, so it's read off the store; `typeof` runs nothing.
type Store = typeof(STORE.Mock)
type Profile = typeof(assert(STORE:StartSessionAsync("", {})))

local PlayerDataService = {}

local store: Store = if RunService:IsStudio() then STORE.Mock else STORE
local profiles: { [number]: Profile } = {}

-- Saves to ProfileStore's mock store from here on, which keeps profiles in memory only, as specs do.
-- Call it before any player loads.
function PlayerDataService.useMockStore()
	store = STORE.Mock
end

-- Starts the player's session. Returns false when it couldn't, or when `cancel` says they left
-- meanwhile.
function PlayerDataService.load(userId: number, cancel: (() -> boolean)?): boolean
	local profile = store:StartSessionAsync(`Player_{userId}`, { Cancel = cancel })
	if profile == nil then
		return false
	end
	profile:AddUserId(userId)
	profile:Reconcile()
	profile.OnSessionEnd:Connect(function()
		if profiles[userId] ~= profile then
			return -- Released here, as when the player left.
		end
		-- The session ended without a release, as when another server took it: the player's changes
		-- would no longer save, so they rejoin with the latest data.
		profiles[userId] = nil
		local player = Players:GetPlayerByUserId(userId)
		if player then
			player:Kick("Your data was loaded on another server. Please rejoin.")
		end
	end)
	profiles[userId] = profile
	return true
end

-- The player's data, or nil when it isn't loaded.
function PlayerDataService.get(userId: number): PlayerData?
	local profile = profiles[userId]
	return if profile then profile.Data else nil
end

-- Replaces the player's data with what `change` returns. Returns false when it isn't loaded.
function PlayerDataService.update(userId: number, change: (data: PlayerData) -> PlayerData): boolean
	local profile = profiles[userId]
	if profile == nil then
		return false
	end
	profile.Data = change(profile.Data)
	return true
end

-- Saves the player's data and ends the session.
function PlayerDataService.release(userId: number)
	local profile = profiles[userId]
	if profile == nil then
		return
	end
	profiles[userId] = nil
	profile:EndSession()
end

-- Main.server.luau calls this once, after every service has loaded.
function PlayerDataService.start()
	local function join(player: Player)
		local loaded = PlayerDataService.load(player.UserId, function()
			return player.Parent == nil
		end)
		-- The player may have left while their data loaded, after it could still be cancelled.
		if player.Parent == nil then
			PlayerDataService.release(player.UserId)
		elseif not loaded then
			player:Kick("Your data couldn't load. Please rejoin.")
		end
	end
	-- Players can join before this service starts, as in a Studio playtest.
	for _, player in Players:GetPlayers() do
		task.spawn(join, player)
	end
	Players.PlayerAdded:Connect(join)
	Players.PlayerRemoving:Connect(function(player)
		PlayerDataService.release(player.UserId)
	end)
end

return PlayerDataService
