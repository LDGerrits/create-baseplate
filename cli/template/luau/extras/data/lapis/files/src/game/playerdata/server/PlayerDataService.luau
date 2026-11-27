-- Loads each player's saved data when they join and saves it when they leave, with Lapis. Other
-- services read and change it through `get` and `update`.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local ServerScriptService = game:GetService("ServerScriptService")

local DataStoreServiceMock = require(ServerScriptService.ServerPackages.DataStoreServiceMock)
local Lapis = require(ServerScriptService.ServerPackages.Lapis)
local PlayerData = require(script.Parent.PlayerData)
local t = require(ReplicatedStorage.Packages.t)

type PlayerData = PlayerData.PlayerData
type Collection = Lapis.Collection<PlayerData>
type Document = Lapis.Document<PlayerData>

local function useMockDataStore()
	-- Lapis types `dataStoreService` as Roblox's DataStoreService, which the mock stands in for
	-- without matching its types.
	Lapis.setConfig({ dataStoreService = DataStoreServiceMock.new() :: any }) -- the mock isn't typed as DataStoreService
end

-- Studio saves to a mock DataStore, which forgets everything when the server stops.
if RunService:IsStudio() then
	useMockDataStore()
end

-- Lapis refuses to load data this rejects, and the player can't join: give each new field a
-- migration below that adds it to data saved before.
local validate = t.strictInterface({ coins = t.number })

local function newCollection(name: string): Collection
	return Lapis.createCollection(name, {
		defaultData = PlayerData.DEFAULT,
		validate = validate,
		-- Each takes data as saved before a change and returns it changed, first to last: for a new
		-- field, `function(data) data.gems = 0 return data end`.
		migrations = {},
	})
end

local PlayerDataService = {}

-- The game's collection is made on the first load, not when this module loads: Lapis allows one
-- collection per name, and a spec switches to its own before any load.
local collection: Collection? = nil
local documents: { [number]: Document } = {}

-- Saves to a fresh mock DataStore from here on, which keeps data in memory only, in a collection of
-- this name: specs give each test its own. Call it before any player loads.
function PlayerDataService.useMockCollection(name: string)
	useMockDataStore()
	collection = newCollection(name)
end

-- Loads the player's document, yielding until it has. Returns false when it couldn't.
function PlayerDataService.load(userId: number): boolean
	local current = collection or newCollection("PlayerData")
	collection = current
	local ok, result = current:load(`Player_{userId}`, { userId }):await()
	if not ok then
		warn(`Player {userId}'s data didn't load: {result}`)
		return false
	end
	documents[userId] = result
	return true
end

-- The player's data, or nil when it isn't loaded. Lapis freezes it: change it through `update`.
function PlayerDataService.get(userId: number): PlayerData?
	local document = documents[userId]
	return if document then document:read() else nil
end

-- Replaces the player's data with what `change` returns, a changed copy: `table.clone(data)`, and a clone of each nested table it changes.
-- Returns false when it isn't loaded.
function PlayerDataService.update(userId: number, change: (data: PlayerData) -> PlayerData): boolean
	local document = documents[userId]
	if document == nil then
		return false
	end
	document:write(change(document:read()))
	return true
end

-- Saves the player's data and closes the document.
function PlayerDataService.release(userId: number)
	local document = documents[userId]
	if document == nil then
		return
	end
	documents[userId] = nil
	document:close():catch(warn)
end

-- Main.server.luau calls this once, after every service has loaded.
function PlayerDataService.start()
	local function join(player: Player)
		local loaded = PlayerDataService.load(player.UserId)
		-- The player may have left while their data loaded.
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
