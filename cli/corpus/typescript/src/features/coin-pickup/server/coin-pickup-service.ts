import { type OnStart, Service } from "@flamework/core";
import { CollectionService, Players } from "@rbxts/services";
import { type CurrencyService } from "../../../game/currency/server/currency-service";
import { COIN_TAG } from "../shared/coin-tag";

export const COIN_VALUE = 10;
export const RESPAWN_SECONDS = 5;

/** Gives a player coins for touching a coin, which is then gone for everyone until it respawns. */
@Service()
export class CoinPickupService implements OnStart {
	private readonly taken = new Set<BasePart>();

	constructor(private readonly currency: CurrencyService) {}

	onStart() {
		CollectionService.GetInstanceAddedSignal(COIN_TAG).Connect((coin) => {
			this.watch(coin);
		});
		for (const coin of CollectionService.GetTagged(COIN_TAG)) this.watch(coin);
	}

	watch(coin: Instance) {
		if (!coin.IsA("BasePart")) return;
		coin.Touched.Connect((hit) => {
			const character = hit.Parent;
			if (character === undefined || !character.IsA("Model")) return;
			const humanoid = character.FindFirstChildOfClass("Humanoid");
			if (!humanoid || humanoid.Health <= 0) return;
			const player = this.playerOf(character);
			if (player) this.collect(coin, player);
		});
	}

	playerOf(character: Model): Player | undefined {
		return Players.GetPlayerFromCharacter(character);
	}

	collect(coin: BasePart, player: Player): boolean {
		// A character touches with several parts at once; only the first one counts.
		if (this.taken.has(coin)) return false;
		this.taken.add(coin);

		const transparency = coin.Transparency;
		coin.Transparency = 1;
		this.currency.add(player, COIN_VALUE);

		task.delay(RESPAWN_SECONDS, () => {
			coin.Transparency = transparency;
			this.taken.delete(coin);
		});
		return true;
	}
}
