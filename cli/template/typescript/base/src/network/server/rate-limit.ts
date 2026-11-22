import { Networking } from "@flamework/networking";
import { Players } from "@rbxts/services";

/**
 * Lets each player through `perSecond` times a second, with bursts of up to one second's worth.
 * `allow` returns whether this call goes through; `now` is in `os.clock()` seconds, and a test
 * passes its own.
 */
export function createRateLimiter(perSecond: number) {
	const buckets = new Map<number, { tokens: number; at: number }>();
	return {
		allow(userId: number, now = os.clock()) {
			const bucket = buckets.get(userId) ?? { at: now, tokens: perSecond };
			bucket.tokens = math.min(perSecond, bucket.tokens + (now - bucket.at) * perSecond);
			bucket.at = now;
			buckets.set(userId, bucket);
			if (bucket.tokens < 1) return false;
			bucket.tokens -= 1;
			return true;
		},
		forget(userId: number) {
			buckets.delete(userId);
		},
	};
}

/** One limiter per remote, which forgets each player who leaves. Calls without a player are the client's own. */
function limiterFor(perSecond: number, clock: () => number) {
	const limiter = createRateLimiter(perSecond);
	Players.PlayerRemoving.Connect((player) => {
		limiter.forget(player.UserId);
	});
	return (player?: Player) => player === undefined || limiter.allow(player.UserId, clock());
}

/**
 * Event middleware that drops a player's calls beyond `perSecond` a second, so a client can't flood
 * the server. It is a floor: the service still checks each request. Give every client-to-server
 * event one: `createServer({ middleware: { click: [rateLimit(20)] } })`.
 */
export function rateLimit<I extends unknown[]>(
	perSecond: number,
	clock: () => number = os.clock,
): Networking.EventMiddleware<I> {
	return (processNext) => {
		const allow = limiterFor(perSecond, clock);
		return (player, ...args) => (allow(player) ? processNext(player, ...args) : undefined);
	};
}

/** `rateLimit` for a client-to-server function: a dropped call returns `Networking.Skip` and never reaches the callback. */
export function rateLimitFunction<I extends unknown[], O>(
	perSecond: number,
	clock: () => number = os.clock,
): Networking.FunctionMiddleware<I, O> {
	return (processNext) => {
		const allow = limiterFor(perSecond, clock);
		return (player, ...args) => (allow(player) ? processNext(player, ...args) : Networking.Skip);
	};
}
