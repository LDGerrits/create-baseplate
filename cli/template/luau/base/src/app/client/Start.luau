-- Starts the client: every controller, then the UI. Main.client.luau calls it, and so does
-- tests/e2e/clicker-ui.luau. Add a feature's controllers to the list to start them; the check fails
-- on a controller that isn't here.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

-- React reads this once, when it first loads. In Studio, React checks hooks and keys and gives
-- readable errors; live servers skip that cost.
-- selene: allow(global_usage) -- react-lua reads its dev flag from _G
_G.__DEV__ = RunService:IsStudio()

local React = require(ReplicatedStorage.Packages.React)
local ReactRoblox = require(ReplicatedStorage.Packages.ReactRoblox)

-- Client code is cloned into each player at runtime, so it reaches other client code from `script`.
local features = script.Parent.Parent.features
local App = require(script.Parent.App)

local controllers: { { start: () -> () } } = {
	require(features.clicker.ClickerController),
}

local Start = {}

function Start.start()
	for _, controller in controllers do
		controller.start()
	end

	local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
	local root = ReactRoblox.createRoot(Instance.new("Folder"))
	root:render(
		React.createElement(React.StrictMode, nil, ReactRoblox.createPortal(React.createElement(App), playerGui))
	)
end

return Start
