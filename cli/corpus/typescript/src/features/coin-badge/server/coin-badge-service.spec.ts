import { beforeEach, describe, expect, it } from "@rbxts/jest-globals";
import { CurrencyService } from "../../../game/currency/server/currency-service";
import { BADGE_COINS, CoinBadgeService } from "./coin-badge-service";

const fakePlayer = () => new Instance("Folder") as unknown as Player;

describe("CoinBadgeService", () => {
	let service: CoinBadgeService;

	beforeEach(() => {
		service = new CoinBadgeService(new CurrencyService());
	});

	it("earns the badge once, at the goal", () => {
		const player = fakePlayer();

		expect(service.earn(player, BADGE_COINS - 1)).toBe(false);
		expect(service.earn(player, BADGE_COINS)).toBe(true);
		expect(service.earn(player, BADGE_COINS + 10)).toBe(false);
	});
});
