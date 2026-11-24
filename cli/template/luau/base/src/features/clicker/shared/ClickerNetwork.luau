-- The clicker's remotes. Each declares the arguments it carries: the type for the type checker, and
-- for what clients send, a `t` check the server runs before any handler sees the call.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remote = require(ReplicatedStorage.Shared.network.Remote)
local t = require(ReplicatedStorage.Packages.t)

return {
	-- Client to server: the player clicked. Carries nothing.
	click = Remote.clientEvent("click", t.tuple()) :: Remote.ClientEvent<()>,
	-- Server to client: the player's new count.
	clicksChanged = Remote.serverEvent("clicksChanged") :: Remote.ServerEvent<number>,
}
