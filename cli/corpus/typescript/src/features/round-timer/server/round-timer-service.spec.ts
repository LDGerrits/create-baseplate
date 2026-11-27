import { describe, expect, it } from "@rbxts/jest-globals";
import { ROUND_SECONDS, RoundTimerService } from "./round-timer-service";

describe("RoundTimerService", () => {
	it("reports each whole second once, and starts a new round at zero", () => {
		const timer = new RoundTimerService();
		expect(timer.step(0.5)).toBe(undefined);
		expect(timer.step(0.6)).toBe(ROUND_SECONDS - 1);
		expect(timer.step(118.9)).toBe(ROUND_SECONDS);
	});
});
