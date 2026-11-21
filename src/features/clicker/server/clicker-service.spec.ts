import { beforeEach, describe, expect, it } from "@rbxts/jest-globals";
import { CLICK_COOLDOWN_SECONDS, ClickerService } from "./clicker-service";

describe("ClickerService", () => {
	let service: ClickerService;

	beforeEach(() => {
		service = new ClickerService();
	});

	it("counts a player's clicks", () => {
		expect(service.click(1, 0)).toBe(1);
		expect(service.click(1, CLICK_COOLDOWN_SECONDS)).toBe(2);
		expect(service.getClicks(1)).toBe(2);
	});

	it("refuses a click inside the cooldown", () => {
		service.click(1, 0);
		expect(service.click(1, CLICK_COOLDOWN_SECONDS / 2)).toBeUndefined();
		expect(service.getClicks(1)).toBe(1);
	});

	it("keeps each player's cooldown apart", () => {
		service.click(1, 0);
		expect(service.click(2, 0)).toBe(1);
	});
});
