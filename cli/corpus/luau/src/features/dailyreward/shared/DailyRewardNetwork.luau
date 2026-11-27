local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remo = require(ReplicatedStorage.Packages.Remo)
local t = require(ReplicatedStorage.Packages.t)

type Remotes = {
	dailyReward: {
		request: Remo.ClientToServer<()>,
		claim: Remo.ClientToServer<()>,
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
