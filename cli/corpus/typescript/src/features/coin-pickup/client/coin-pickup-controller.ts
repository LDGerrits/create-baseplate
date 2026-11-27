import { Controller, type OnTick } from "@flamework/core";
import { CollectionService } from "@rbxts/services";
import { COIN_TAG } from "../shared/coin-tag";

const RADIANS_PER_SECOND = math.pi;

/** Spins the coins on each player's device, which is smooth and sends nothing over the network. */
@Controller()
export class CoinPickupController implements OnTick {
	onTick(dt: number) {
		const turn = CFrame.Angles(0, RADIANS_PER_SECOND * dt, 0);
		for (const coin of CollectionService.GetTagged(COIN_TAG)) {
			if (!coin.IsA("BasePart")) continue;
			coin.CFrame = new CFrame(coin.Position).mul(turn).mul(coin.CFrame.Rotation);
		}
	}
}
