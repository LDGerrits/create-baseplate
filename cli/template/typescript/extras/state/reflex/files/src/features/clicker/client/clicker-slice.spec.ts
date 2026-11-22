import { beforeEach, describe, expect, it } from "@rbxts/jest-globals";
import { clickerSlice } from "./clicker-slice";

describe("clickerSlice", () => {
	beforeEach(() => {
		clickerSlice.resetState();
	});

	it("starts at no clicks", () => {
		expect(clickerSlice.getState().clicks).toBe(0);
	});

	it("takes the count the server sends", () => {
		clickerSlice.setClicks(3);
		expect(clickerSlice.getState().clicks).toBe(3);
	});
});
