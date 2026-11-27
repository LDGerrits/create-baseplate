import { describe, expect, it } from "@rbxts/jest-globals";
import { RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
	it("lets a key through once per window, and again after it", () => {
		let now = 0;
		const limiter = new RateLimiter<number>(1, () => now);
		expect(limiter.allow(1)).toBe(true);
		now = 0.5;
		expect(limiter.allow(1)).toBe(false);
		now = 1;
		expect(limiter.allow(1)).toBe(true);
	});

	it("counts each key on its own", () => {
		const limiter = new RateLimiter<number>(1, () => 0);
		expect(limiter.allow(1)).toBe(true);
		expect(limiter.allow(2)).toBe(true);
		expect(limiter.allow(1)).toBe(false);
	});

	it("starts a forgotten key over", () => {
		const limiter = new RateLimiter<number>(1, () => 0);
		limiter.allow(1);
		limiter.forget(1);
		expect(limiter.allow(1)).toBe(true);
	});
});
