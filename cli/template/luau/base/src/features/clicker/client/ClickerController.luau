-- Sends click requests, and keeps the server's latest count for the UI.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ClickerNetwork = require(ReplicatedStorage.Shared.features.clicker.ClickerNetwork)

local ClickerController = {}

local clicks = 0
local listeners: { [(number) -> ()]: true } = {}

-- Start.luau calls this once, after every controller has loaded.
function ClickerController.start()
	ClickerNetwork.clicksChanged:connect(function(count)
		clicks = count
		for listener in listeners do
			listener(count)
		end
	end)
end

function ClickerController.getClicks(): number
	return clicks
end

-- Calls `listener` with each new count. Returns a function that stops it.
function ClickerController.subscribe(listener: (number) -> ()): () -> ()
	listeners[listener] = true
	return function()
		listeners[listener] = nil
	end
end

function ClickerController.click()
	ClickerNetwork.click:fire()
end

return ClickerController
