import { beforeEach, describe, expect, it } from "@rbxts/jest-globals";
import { FakeClock } from "../../../platform/clock/shared/fake-clock";
import { CLICK_COOLDOWN_SECONDS } from "../shared/clicker-rules";
import { ClickerService } from "./clicker-service";

describe("ClickerService", () => {
	let clock: FakeClock;
	let service: ClickerService;

	beforeEach(() => {
		clock = new FakeClock();
		service = new ClickerService(clock);
	});

	it("counts a player's clicks", () => {
		expect(service.click(1)).toBe(1);
		clock.advance(CLICK_COOLDOWN_SECONDS);
		expect(service.click(1)).toBe(2);
		expect(service.getClicks(1)).toBe(2);
	});

	it("refuses a click inside the cooldown", () => {
		service.click(1);
		clock.advance(CLICK_COOLDOWN_SECONDS / 2);
		expect(service.click(1)).toBeUndefined();
		expect(service.getClicks(1)).toBe(1);
	});

	it("keeps each player's cooldown apart", () => {
		service.click(1);
		expect(service.click(2)).toBe(1);
	});
});
