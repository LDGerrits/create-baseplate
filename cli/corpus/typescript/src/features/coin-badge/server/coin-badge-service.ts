import { type OnStart, Service } from "@flamework/core";
import { BadgeService, Players } from "@rbxts/services";
import { type CurrencyService } from "../../../game/currency/server/currency-service";

export const BADGE_COINS = 100;
// The badge's id on the Creator Hub.
const BADGE_ID = 0;

@Service()
export class CoinBadgeService implements OnStart {
	private readonly earned = new Set<Player>();

	constructor(private readonly currency: CurrencyService) {}

	onStart() {
		this.currency.changed.Connect((player, coins) => {
			if (this.earn(player, coins)) this.award(player);
		});
		Players.PlayerRemoving.Connect((player) => this.earned.delete(player));
	}

	/** True the first time a player's coins reach the badge's goal. */
	earn(player: Player, coins: number): boolean {
		if (coins < BADGE_COINS || this.earned.has(player)) return false;
		this.earned.add(player);
		return true;
	}

	private award(player: Player) {
		const [awarded, problem] = pcall(() => BadgeService.AwardBadgeAsync(player.User, BADGE_ID));
		if (!awarded) warn(`Couldn't award the coin badge to ${player.Name}: ${tostring(problem)}`);
	}
}
