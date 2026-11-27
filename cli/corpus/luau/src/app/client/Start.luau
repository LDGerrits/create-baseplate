-- Starts the client: every controller. Main.client.luau calls it, and so can tests. Add a feature's
-- controllers to the list to start them; the check fails on a controller that isn't here.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

-- At the top of Start.luau: React reads this flag once, when it first loads. In Studio, React checks
-- hooks and keys and gives readable errors; live servers skip that cost.
-- selene: allow(global_usage) -- react-lua reads its dev flag from _G
_G.__DEV__ = RunService:IsStudio()

local React = require(ReplicatedStorage.Packages.React)
local ReactRoblox = require(ReplicatedStorage.Packages.ReactRoblox)

local App = require(script.Parent.App)

-- Client code is cloned into each player at runtime, so it reaches other client code from `script`.
local features = script.Parent.Parent.features

local controllers: { { start: () -> () } } = {
	require(features.coinpickup.CoinPickupController),
	require(features.dailyreward.DailyRewardController),
}

local Start = {}

function Start.start()
	for _, controller in controllers do
		controller.start()
	end

	-- In Start.start(), after the controllers:
	local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
	local root = ReactRoblox.createRoot(Instance.new("Folder"))
	root:render(
		React.createElement(React.StrictMode, nil, ReactRoblox.createPortal(React.createElement(App), playerGui))
	)
end

return Start
