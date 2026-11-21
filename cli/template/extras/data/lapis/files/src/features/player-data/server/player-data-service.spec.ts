import { beforeAll, describe, expect, it } from "@rbxts/jest-globals";
import { setConfig } from "@rbxts/lapis";
import DataStoreServiceMock from "@rbxts/lapis-mockdatastore";
import { DEFAULT_PLAYER_DATA } from "./player-data";
import { PlayerDataService } from "./player-data-service";

// Each test gets its own collection, so documents don't carry over between tests.
let collections = 0;
const newService = () => PlayerDataService.withCollection(`Test_${++collections}`);

describe("PlayerDataService", () => {
	beforeAll(() => {
		setConfig({ dataStoreService: new DataStoreServiceMock() });
	});

	it("starts a new player with the defaults", async () => {
		const service = newService();
		expect(await service.load(1)).toBe(true);
		expect(service.get(1)).toEqual(DEFAULT_PLAYER_DATA);
	});

	it("keeps an update after the player leaves and rejoins", async () => {
		const service = newService();
		await service.load(1);
		service.update(1, (data) => ({ ...data, coins: data.coins + 5 }));
		service.release(1);
		expect(service.get(1)).toBeUndefined();
		await service.load(1);
		expect(service.get(1)?.coins).toBe(5);
	});

	it("changes nothing for a player who isn't loaded", () => {
		expect(newService().update(2, (data) => data)).toBe(false);
	});
});
