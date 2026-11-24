-- Owns every player's click count. Clients ask to click; this service decides.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ClickerNetwork = require(ReplicatedStorage.Shared.features.clicker.ClickerNetwork)

local ClickerService = {}

-- Seconds a player waits between counted clicks.
ClickerService.COOLDOWN_SECONDS = 0.1

local clicks: { [number]: number } = {}
local lastClickAt: { [number]: number } = {}

function ClickerService.getClicks(userId: number): number
	return clicks[userId] or 0
end

-- Counts a click unless it comes inside the cooldown. Returns the new count, or nil when refused.
-- `now` is in `os.clock()` seconds; a test passes its own.
function ClickerService.click(userId: number, now: number?): number?
	local at = now or os.clock()
	local last = lastClickAt[userId]
	if last ~= nil and at - last < ClickerService.COOLDOWN_SECONDS then
		return nil
	end
	lastClickAt[userId] = at
	local count = ClickerService.getClicks(userId) + 1
	clicks[userId] = count
	return count
end

-- Forgets a player, as when they leave.
function ClickerService.forget(userId: number)
	clicks[userId] = nil
	lastClickAt[userId] = nil
end

-- Main.server.luau calls this once, after every service has loaded.
function ClickerService.start()
	-- The remote's throttle drops floods before they reach the service, which still applies its own cooldown.
	ClickerNetwork.click:connect(function(player)
		local count = ClickerService.click(player.UserId)
		if count ~= nil then
			ClickerNetwork.clicksChanged:fire(player, count)
		end
	end)
	Players.PlayerRemoving:Connect(function(player)
		ClickerService.forget(player.UserId)
	end)
end

return ClickerService
