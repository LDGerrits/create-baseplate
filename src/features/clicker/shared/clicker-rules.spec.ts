import { describe, expect, it } from "@rbxts/jest-globals";
import { CLICK_COOLDOWN_SECONDS, canClick } from "./clicker-rules";

describe("canClick", () => {
	it("allows the first click", () => {
		expect(canClick(undefined, 0)).toBe(true);
	});

	it("blocks a click inside the cooldown", () => {
		expect(canClick(1, 1 + CLICK_COOLDOWN_SECONDS / 2)).toBe(false);
	});

	it("allows a click once the cooldown has passed", () => {
		expect(canClick(1, 1 + CLICK_COOLDOWN_SECONDS)).toBe(true);
	});
});
