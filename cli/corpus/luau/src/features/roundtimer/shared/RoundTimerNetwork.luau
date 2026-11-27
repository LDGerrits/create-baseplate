local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remo = require(ReplicatedStorage.Packages.Remo)
local t = require(ReplicatedStorage.Packages.t)

type Remotes = {
	roundTimer: {
		tick: Remo.ServerToClient<number>,
	},
}

local remotes: Remotes = Remo.createRemotes({
	roundTimer = Remo.namespace({
		tick = Remo.remote(t.number),
	}),
})

return remotes.roundTimer
