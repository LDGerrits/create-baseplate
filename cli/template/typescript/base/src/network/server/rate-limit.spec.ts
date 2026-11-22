import { Networking } from "@flamework/networking";
import { describe, expect, it } from "@rbxts/jest-globals";
import { createRateLimiter, rateLimit, rateLimitFunction } from "./rate-limit";

const EVENT = { eventType: "Event", globalName: "test", name: "test" } as const;
const player = (userId: number) => ({ UserId: userId }) as Player;

describe("createRateLimiter", () => {
	it("lets a second's worth through at once, then refuses", () => {
		const limiter = createRateLimiter(3);
		expect([1, 2, 3, 4].map(() => limiter.allow(1, 0))).toEqual([true, true, true, false]);
	});

	it("lets calls through again as time passes", () => {
		const limiter = createRateLimiter(2);
		limiter.allow(1, 0);
		limiter.allow(1, 0);
		expect(limiter.allow(1, 0.25)).toBe(false);
		expect(limiter.allow(1, 0.5)).toBe(true);
	});

	it("keeps each player's limit apart", () => {
		const limiter = createRateLimiter(1);
		limiter.allow(1, 0);
		expect(limiter.allow(1, 0)).toBe(false);
		expect(limiter.allow(2, 0)).toBe(true);
	});
});

describe("rateLimit", () => {
	it("passes calls on to the handler until the player is over the limit", () => {
		const handled: number[] = [];
		const middleware = rateLimit<[number]>(2, () => 0)((_, value) => {
			handled.push(value);
			return Promise.resolve();
		}, EVENT);
		for (const value of [1, 2, 3]) middleware(player(1), value);
		expect(handled).toEqual([1, 2]);
	});
});

describe("rateLimitFunction", () => {
	it("returns Skip for a call over the limit", () => {
		const middleware = rateLimitFunction<[], string>(1, () => 0)(() => Promise.resolve("ok"), EVENT);
		middleware(player(1));
		expect(middleware(player(1))).toBe(Networking.Skip);
	});
});
