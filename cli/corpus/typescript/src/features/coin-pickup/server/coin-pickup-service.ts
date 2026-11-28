import { type OnStart, Service } from "@flamework/core";
import { Janitor } from "@rbxts/janitor";
import { CollectionService, Players } from "@rbxts/services";
import { type CurrencyService } from "../../../game/currency/server/currency-service";
import { COIN_TAG } from "../shared/coin-tag";

export const COIN_VALUE = 10;
export const RESPAWN_SECONDS = 5;

@Service()
export class CoinPickupService implements OnStart {
	private readonly taken = new Set<BasePart>();
	private readonly janitors = new Map<Instance, Janitor<{ respawn: thread }>>();

	constructor(private readonly currency: CurrencyService) {}

	onStart() {
		CollectionService.GetInstanceAddedSignal(COIN_TAG).Connect((coin) => {
			this.watch(coin);
		});
		CollectionService.GetInstanceRemovedSignal(COIN_TAG).Connect((coin) => {
			this.janitors.get(coin)?.Destroy();
			this.janitors.delete(coin);
		});
		for (const coin of CollectionService.GetTagged(COIN_TAG)) this.watch(coin);
	}

	watch(coin: Instance) {
		if (!coin.IsA("BasePart")) return;
		const janitor = new Janitor<{ respawn: thread }>();
		this.janitors.set(coin, janitor);
		janitor.Add(() => this.taken.delete(coin), true);
		janitor.Add(
			coin.Touched.Connect((hit) => {
				const character = hit.Parent;
				if (character === undefined || !character.IsA("Model")) return;
				const humanoid = character.FindFirstChildOfClass("Humanoid");
				if (!humanoid || humanoid.Health <= 0) return;
				const player = this.playerOf(character);
				if (player) this.collect(coin, player);
			}),
		);
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

		const respawn = task.delay(RESPAWN_SECONDS, () => {
			coin.Transparency = transparency;
			this.taken.delete(coin);
		});
		this.janitors.get(coin)?.Add(respawn, true, "respawn");
		return true;
	}
}
