-- The only way the server takes what clients send: each handler gets a rate limit, and calls whose
-- arguments fail the remote's `check` are dropped before it runs. Never connect `OnServerEvent` or
-- set `OnServerInvoke` yourself; the check fails on code that does, outside this folder.
local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local RateLimit = require(ServerScriptService.Network.RateLimit)
local Remote = require(ReplicatedStorage.Shared.Network.Remote)

export type Options = {
	-- `RateLimit.perSecond(20)`, or `RateLimit.trustsClient("<why>")` for a remote that takes every call.
	limit: RateLimit.Limit,
}

local Serve = {}

-- Runs `handler` for each event a client sends that passes the limit and the remote's check.
function Serve.event<T...>(
	remote: Remote.ClientEvent<T...>,
	options: Options,
	handler: (Player, T...) -> ()
): RBXScriptConnection
	return remote.instance.OnServerEvent:Connect(function(player: Player, ...: any)
		if not options.limit:allow(player.UserId) or not remote.check(...) then
			return
		end
		handler(player, ...)
	end)
end

-- Answers each request a client sends that passes the limit and the remote's check. A dropped call
-- returns nothing to the client.
function Serve.request<T..., R...>(remote: Remote.ClientRequest<T..., R...>, options: Options, handler: (Player, T...) -> R...)
	remote.instance.OnServerInvoke = function(player: Player, ...: any): ...any
		if not options.limit:allow(player.UserId) or not remote.check(...) then
			return
		end
		return handler(player, ...)
	end
end

return Serve
