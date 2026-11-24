-- The clicker's remotes, made with Remo. The type gives both sides each remote's arguments; Remo
-- runs the `t` validators on what arrives before any handler sees it, so every argument a client
-- sends gets one, and throttleMiddleware drops a player's floods.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remo = require(ReplicatedStorage.Packages.Remo)
local t = require(ReplicatedStorage.Packages.t)

type Remotes = {
	clicker: {
		-- Client to server: the player clicked. Carries nothing.
		click: Remo.ClientToServer<()>,
		-- Server to client: the player's new count.
		clicksChanged: Remo.ServerToClient<number>,
	},
}

-- Remo keeps every remote in one folder, so the feature's namespace keeps its names apart from
-- other features': these are "clicker.click" and "clicker.clicksChanged".
local remotes: Remotes = Remo.createRemotes({
	clicker = Remo.namespace({
		click = Remo.remote().middleware(Remo.throttleMiddleware(0.05)),
		clicksChanged = Remo.remote(t.number),
	}),
})

return remotes.clicker
