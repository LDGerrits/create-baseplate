-- The round timer's remote. Clients send nothing: the server only broadcasts, so the feature needs
-- no end-to-end test of requests.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remo = require(ReplicatedStorage.Packages.Remo)
local t = require(ReplicatedStorage.Packages.t)

type Remotes = {
	roundTimer: {
		-- Server to client: whole seconds left in the round.
		tick: Remo.ServerToClient<number>,
	},
}

local remotes: Remotes = Remo.createRemotes({
	roundTimer = Remo.namespace({
		tick = Remo.remote(t.number),
	}),
})

return remotes.roundTimer
