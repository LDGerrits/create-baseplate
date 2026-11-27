import { Networking } from "@flamework/networking";
import { Players } from "@rbxts/services";

/** Lets each key through at most once every `seconds`, by the clock `now` reads. */
export class RateLimiter<K> {
	private readonly last = new Map<K, number>();

	constructor(
		private readonly seconds: number,
		private readonly now: () => number = os.clock,
	) {}

	/** Whether `key` may go through now; when it may, the wait starts again. */
	allow(key: K): boolean {
		const now = this.now();
		const last = this.last.get(key);
		if (last !== undefined && now - last < this.seconds) return false;
		this.last.set(key, now);
		return true;
	}

	forget(key: K) {
		this.last.delete(key);
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
 * Flamework middleware for a client-to-server event: drops a player's event when it comes less than
 * `seconds` after the last one let through. A limit is only a floor: the service still checks each
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
