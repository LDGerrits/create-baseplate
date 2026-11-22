-- Starts the client: every controller, then the UI. Main.client.luau calls it, and so does
-- tests/e2e/clicker-ui.luau. Add a feature's controllers to the list to start them; the check fails
-- on a controller that isn't here.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Vide = require(ReplicatedStorage.Packages.Vide)

-- Client code is cloned into each player at runtime, so it reaches other client code from `script`.
local Features = script.Parent.Parent.Features
local App = require(script.Parent.App)

local controllers: { { start: () -> () } } = {
	require(Features.Clicker.ClickerController),
}

local Start = {}

function Start.start()
	for _, controller in controllers do
		controller.start()
	end

	-- In Studio, Vide checks for mistakes and gives readable errors; live servers skip that cost.
	Vide.strict = RunService:IsStudio()

	local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
	Vide.mount(App, playerGui)
end

return Start
