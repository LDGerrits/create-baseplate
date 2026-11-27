-- The daily reward's remotes, made with Remo.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remo = require(ReplicatedStorage.Packages.Remo)
local t = require(ReplicatedStorage.Packages.t)

type Remotes = {
	dailyReward: {
		-- Client to server: asks for the seconds until the next claim.
		request: Remo.ClientToServer<()>,
		claim: Remo.ClientToServer<()>,
		-- Server to client: the seconds until the next claim; 0 when the player may claim now.
		changed: Remo.ServerToClient<number>,
	},
}

local remotes: Remotes = Remo.createRemotes({
	dailyReward = Remo.namespace({
		request = Remo.remote().middleware(Remo.throttleMiddleware(0.1)),
		claim = Remo.remote().middleware(Remo.throttleMiddleware(1)),
		changed = Remo.remote(t.number),
	}),
})

return remotes.dailyReward
