-- Sends click requests, and keeps the server's latest count in a Charm signal for the UI.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Charm = require(ReplicatedStorage.Packages.Charm)
local ClickerNetwork = require(ReplicatedStorage.Shared.Features.Clicker.ClickerNetwork)

local ClickerController = {}

local getClicks, setClicks = Charm.signal(0)

-- The latest count: call it to read it, and read it in UI with `useSignalState(ClickerController.clicks)`.
-- Only this controller sets it.
ClickerController.clicks = getClicks

-- Start.luau calls this once, after every controller has loaded.
function ClickerController.start()
	ClickerNetwork.clicksChanged:connect(function(count)
		setClicks(count)
	end)
end

function ClickerController.click()
	ClickerNetwork.click:fire()
end

return ClickerController
