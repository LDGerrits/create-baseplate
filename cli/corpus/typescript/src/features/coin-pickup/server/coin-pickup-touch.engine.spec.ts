import { afterEach, describe, expect, it, jest } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { CurrencyService } from "../../../game/currency/server/currency-service";
import { CoinPickupService } from "./coin-pickup-service";

describe("CoinPickupService touch", () => {
	const made = new Array<Instance>();

	afterEach(() => {
		for (const instance of made) instance.Destroy();
		made.clear();
	});

	it("collects when a character's part runs into the coin", () => {
		const currency = new CurrencyService();
		const service = new CoinPickupService(currency);
		const player = new Instance("Folder") as unknown as Player;
		// No player joins a test run, so say who the character belongs to.
		jest.spyOn(service, "playerOf").mockReturnValue(player);

		const coin = new Instance("Part");
		coin.Anchored = true;
		coin.CanCollide = false;
		coin.Position = new Vector3(0, 100, 0);
		coin.Parent = Workspace;
		service.watch(coin);

		const character = new Instance("Model");
		new Instance("Humanoid").Parent = character;
		const body = new Instance("Part");
		body.Name = "HumanoidRootPart";
		body.Position = new Vector3(0, 104, 0);
		body.Parent = character;
		character.Parent = Workspace;
		made.push(coin, character);

		const deadline = os.clock() + 5;
		while (currency.getCoins(player) === 0 && os.clock() < deadline) task.wait();

		expect(currency.getCoins(player)).toBe(10);
		expect(coin.Transparency).toBe(1);
	});
});
