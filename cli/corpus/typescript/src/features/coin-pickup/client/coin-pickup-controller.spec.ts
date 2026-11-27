import { describe, expect, it } from "@rbxts/jest-globals";
import { CollectionService, Workspace } from "@rbxts/services";
import { COIN_TAG } from "../shared/coin-tag";
import { CoinPickupController } from "./coin-pickup-controller";

describe("CoinPickupController", () => {
	it("turns a coin where it stands", () => {
		const coin = new Instance("Part");
		coin.Position = new Vector3(1, 2, 3);
		CollectionService.AddTag(coin, COIN_TAG);
		coin.Parent = Workspace;

		new CoinPickupController().onTick(0.5);

		// Half a second is a quarter turn.
		expect(coin.CFrame.RightVector.Z).toBeCloseTo(-1);
		expect(coin.Position).toEqual(new Vector3(1, 2, 3));
		coin.Destroy();
	});
});
