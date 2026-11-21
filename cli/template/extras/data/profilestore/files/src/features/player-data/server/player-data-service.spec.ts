import { describe, expect, it } from "@rbxts/jest-globals";
import ProfileStore from "@rbxts/profile-store";
import { DEFAULT_PLAYER_DATA } from "./player-data";
import { PlayerDataService } from "./player-data-service";

// Each test gets its own store name, so profiles don't carry over between tests.
let stores = 0;
const newService = () => PlayerDataService.withStore(ProfileStore.New(`Test_${++stores}`, DEFAULT_PLAYER_DATA).Mock);

describe("PlayerDataService", () => {
	it("starts a new player with the defaults", () => {
		const service = newService();
		expect(service.load(1)).toBe(true);
		expect(service.get(1)).toEqual(DEFAULT_PLAYER_DATA);
	});

	it("keeps an update after the player leaves and rejoins", () => {
		const service = newService();
		service.load(1);
		service.update(1, (data) => ({ ...data, coins: data.coins + 5 }));
		service.release(1);
		expect(service.get(1)).toBeUndefined();
		service.load(1);
		expect(service.get(1)?.coins).toBe(5);
	});

	it("changes nothing for a player who isn't loaded", () => {
		expect(newService().update(2, (data) => data)).toBe(false);
	});
});
