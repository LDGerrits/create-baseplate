import { describe, expect, it } from "@rbxts/jest-globals";
import { RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
	it("lets a burst through at once, then one per interval", () => {
		let now = 0;
		const limiter = new RateLimiter<number>(1, 3, () => now);
		expect([limiter.allow(1), limiter.allow(1), limiter.allow(1), limiter.allow(1)]).toEqual([true, true, true, false]);
		now = 1;
		expect(limiter.allow(1)).toBe(true);
		expect(limiter.allow(1)).toBe(false);
	});

	it("doesn't drop a player acting at the allowed rate when a request arrives a little early", () => {
		let now = 0;
		const limiter = new RateLimiter<number>(1, 3, () => now);
		for (const at of [0, 0.98, 1.97, 2.0, 3.0, 3.99]) {
			now = at;
			expect(limiter.allow(1)).toBe(true);
		}
	});

	it("counts each key on its own", () => {
		const limiter = new RateLimiter<number>(1, 1, () => 0);
		expect(limiter.allow(1)).toBe(true);
		expect(limiter.allow(2)).toBe(true);
		expect(limiter.allow(1)).toBe(false);
	});

	it("starts a forgotten key over", () => {
		const limiter = new RateLimiter<number>(1, 1, () => 0);
		limiter.allow(1);
		limiter.forget(1);
		expect(limiter.allow(1)).toBe(true);
	});
});
