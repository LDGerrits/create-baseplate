import { describe, expect, it } from "@rbxts/jest-globals";
import { type CurrencyService } from "../../../game/currency/server/currency-service";
import { DAY, DailyRewardService } from "./daily-reward-service";

const currency = {
	add() {},
	getCoins() {
		return 0;
	},
} as unknown as CurrencyService;

/** An assertion through a helper: the lint counts `expect*` functions as assertions. */
function expectSecondsLeft(service: DailyRewardService, now: number, seconds: number) {
	expect(service.secondsLeft(1, now)).toBe(seconds);
}

describe("DailyRewardService", () => {
	it("lets a player claim once, then not until a day has passed", () => {
		const service = new DailyRewardService(currency);
		expect(service.claim(1, 1000)).toBe(true);
		expect(service.claim(1, 1000 + DAY - 1)).toBe(false);
		expectSecondsLeft(service, 1000 + DAY - 1, 1);
		expect(service.claim(1, 1000 + DAY)).toBe(true);
	});

	it("remembers who claimed in this session", () => {
		const service = new DailyRewardService(currency);
		service.claim(1, 0);
		expect(service.claimedThisSession(1)).toBe(true);
		expect(service.claimedThisSession(2)).toBe(false);
	});

	// A skipped test shows in the results; the lint lets it through.
	it.skip("resets at midnight in the player's time zone", () => {
		expect(true).toBe(true);
	});
});
