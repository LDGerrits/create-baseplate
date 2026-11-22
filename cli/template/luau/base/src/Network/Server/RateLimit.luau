-- Rate limits for what clients send. Serve.luau takes one for every client-to-server remote, so a
-- client can't flood the server. It is a floor: the service still checks each request.
local Players = game:GetService("Players")

export type Limit = {
	-- Whether this call from `userId` goes through. `now` is in `os.clock()` seconds; a test passes its own.
	allow: (self: Limit, userId: number, now: number?) -> boolean,
	-- Drops what the limit knows of a player, such as when they leave.
	forget: (self: Limit, userId: number) -> (),
}

local RateLimit = {}

-- Lets each player through `perSecond` times a second, with bursts of up to one second's worth (and
-- at least one call). Below 1, it's one call every `1 / perSecond` seconds.
-- Forgets each player who leaves. `clock` replaces `os.clock` in tests.
function RateLimit.perSecond(perSecond: number, clock: (() -> number)?): Limit
	local read = clock or os.clock
	assert(perSecond > 0, "RateLimit.perSecond: give a rate above 0; RateLimit.trustsClient takes every call")
	local burst = math.max(1, perSecond)
	type Bucket = { tokens: number, at: number }
	local buckets: { [number]: Bucket } = {}
	local limit: Limit = {
		allow = function(_self: Limit, userId: number, now: number?): boolean
			local at = now or read()
			local bucket: Bucket = buckets[userId] or { tokens = burst, at = at }
			-- A burst holds a second's worth, and at least one call, so a slow limit such as 0.5 (one call
			-- every two seconds) still lets calls through.
			bucket.tokens = math.min(burst, bucket.tokens + (at - bucket.at) * perSecond)
			bucket.at = at
			buckets[userId] = bucket
			if bucket.tokens < 1 then
				return false
			end
			bucket.tokens -= 1
			return true
		end,
		forget = function(_self: Limit, userId: number)
			buckets[userId] = nil
		end,
	}
	Players.PlayerRemoving:Connect(function(player)
		limit:forget(player.UserId)
	end)
	return limit
end

-- No limit, for a remote that must take every call. Say why, as `reason`: the reader of the code,
-- and of the check that looks for unguarded remotes, needs it.
function RateLimit.trustsClient(reason: string): Limit
	assert(reason ~= "", "RateLimit.trustsClient: say why this remote takes every call")
	return {
		allow = function(_self: Limit, _userId: number, _now: number?): boolean
			return true
		end,
		forget = function(_self: Limit, _userId: number) end,
	}
end

return RateLimit
