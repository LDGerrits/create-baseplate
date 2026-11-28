import { describe, expect, it } from "@rbxts/jest-globals";
import { CurrencyService } from "./currency-service";

const fakePlayer = () => new Instance("Folder") as unknown as Player;

describe("CurrencyService", () => {
	it("adds up each player's coins separately", () => {
		const currency = new CurrencyService();
		const first = fakePlayer();
		const second = fakePlayer();

		currency.add(first, 10);
		currency.add(first, 10);

		expect(currency.getCoins(first)).toBe(20);
		expect(currency.getCoins(second)).toBe(0);
	});

	it("announces each player's new balance", () => {
		const currency = new CurrencyService();
		const player = fakePlayer();
		const heard: number[] = [];
		currency.changed.Connect((who, coins) => {
			if (who === player) heard.push(coins);
		});

		currency.add(player, 10);
		currency.add(player, 5);

		expect(heard).toEqual([10, 15]);
	});
});
