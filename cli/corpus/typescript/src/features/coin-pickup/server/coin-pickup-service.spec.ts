import { afterEach, beforeEach, describe, expect, it, jest } from "@rbxts/jest-globals";
import { CurrencyService } from "../../../game/currency/server/currency-service";
import { CoinPickupService } from "./coin-pickup-service";

const fakePlayer = () => new Instance("Folder") as unknown as Player;

describe("CoinPickupService", () => {
	let currency: CurrencyService;
	let service: CoinPickupService;
	let coin: Part;

	beforeEach(() => {
		jest.useFakeTimers();
		currency = new CurrencyService();
		service = new CoinPickupService(currency);
		coin = new Instance("Part");
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("gives 10 coins and hides the coin", () => {
		const player = fakePlayer();

		expect(service.collect(coin, player)).toBe(true);

		expect(currency.getCoins(player)).toBe(10);
		expect(coin.Transparency).toBe(1);
	});

	it("gives nothing while the coin is gone", () => {
		const first = fakePlayer();
		const second = fakePlayer();
		service.collect(coin, first);

		expect(service.collect(coin, second)).toBe(false);
		expect(currency.getCoins(second)).toBe(0);
	});

	it("respawns the coin after 5 seconds", () => {
		const player = fakePlayer();
		service.collect(coin, player);

		jest.advanceTimersByTime(4900);
		expect(service.collect(coin, player)).toBe(false);

		jest.advanceTimersByTime(200);
		expect(coin.Transparency).toBe(0);
		expect(service.collect(coin, player)).toBe(true);
		expect(currency.getCoins(player)).toBe(20);
	});
});
