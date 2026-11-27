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

function PlayerDataService.useMockStore()
	store = STORE.Mock
end

function PlayerDataService.load(userId: number, cancel: (() -> boolean)?): boolean
	local profile = store:StartSessionAsync(`Player_{userId}`, { Cancel = cancel })
	if profile == nil then
		return false
	end
	profile:AddUserId(userId)
	profile:Reconcile()
	profile.OnSessionEnd:Connect(function()
		local releasedHere = profiles[userId] ~= profile
		if releasedHere then
			return
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

function PlayerDataService.get(userId: number): PlayerData?
	local profile = profiles[userId]
	return if profile then profile.Data else nil
end

function PlayerDataService.update(userId: number, change: (data: PlayerData) -> PlayerData): boolean
	local profile = profiles[userId]
	if profile == nil then
		return false
	end
	profile.Data = change(profile.Data)
	return true
end

function PlayerDataService.release(userId: number)
	local profile = profiles[userId]
	if profile == nil then
		return
	end
	profiles[userId] = nil
	profile:EndSession()
end

function PlayerDataService.start()
	local function join(player: Player)
		local function hasLeft()
			return player.Parent == nil
		end
		local loaded = PlayerDataService.load(player.UserId, hasLeft)
		if hasLeft() then
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
