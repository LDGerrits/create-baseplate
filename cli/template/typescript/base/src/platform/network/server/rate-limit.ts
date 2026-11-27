import { Networking } from "@flamework/networking";
import { Players } from "@rbxts/services";

/** How many requests in a row pass before the limit starts to count, by default. */
const BURST = 3;

/**
 * Lets each key through once every `seconds` on average, with a burst of `burst` at once: a token
 * bucket that refills one token every `seconds`. The burst absorbs network jitter, so a player who
 * acts at exactly the allowed rate isn't dropped when two requests arrive a little close together.
 */
export class RateLimiter<K> {
	private readonly buckets = new Map<K, { tokens: number; at: number }>();

	constructor(
		private readonly seconds: number,
		private readonly burst = BURST,
		private readonly now: () => number = os.clock,
	) {}

	/** Whether `key` may go through now; when it may, it uses one token. */
	allow(key: K): boolean {
		const now = this.now();
		const bucket = this.buckets.get(key) ?? { tokens: this.burst, at: now };
		bucket.tokens = math.min(this.burst, bucket.tokens + (now - bucket.at) / this.seconds);
		bucket.at = now;
		this.buckets.set(key, bucket);
		if (bucket.tokens < 1) return false;
		bucket.tokens -= 1;
		return true;
	}

	forget(key: K) {
		this.buckets.delete(key);
	}
}

/** A limiter per remote, keyed by player, that forgets a player who leaves. */
function playerLimiter(seconds: number): RateLimiter<Player> {
	const limiter = new RateLimiter<Player>(seconds);
	Players.PlayerRemoving.Connect((player) => {
		limiter.forget(player);
	});
	return limiter;
}

/**
 * Flamework middleware for a client-to-server event: lets a player's events through once every
 * `seconds` on average, with a burst of three, and drops the rest. Set `seconds` to the fastest a
 * real player does the action. A limit is only a floor: the service still checks each
 * request (ownership, cost, cooldowns). Give it in a network's server options:
 * `middleware: { buy: [rateLimit(0.5)] }`.
 */
export function rateLimit<I extends readonly unknown[]>(seconds: number): Networking.EventMiddleware<I> {
	return (processNext) => {
		const limiter = playerLimiter(seconds);
		return (player, ...args) => {
			if (player === undefined || !limiter.allow(player)) return;
			return processNext(player, ...args);
		};
	};
}

/**
 * The same for a client-to-server function: a request that comes too soon is cancelled, and the
 * client's call rejects with `NetworkingFunctionError.Cancelled`: `middleware: { price: [rateLimitFunction(0.2)] }`.
 */
export function rateLimitFunction<I extends readonly unknown[], O>(
	seconds: number,
): Networking.FunctionMiddleware<I, O> {
	return (processNext) => {
		const limiter = playerLimiter(seconds);
		return (player, ...args) => {
			if (player === undefined || !limiter.allow(player)) return Networking.Skip;
			return processNext(player, ...args);
		};
	};
}
