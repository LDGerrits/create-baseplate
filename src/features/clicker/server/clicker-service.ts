import { type OnStart, Service } from "@flamework/core";
import { Players } from "@rbxts/services";
import { ClickerNetwork } from "../shared/clicker-network";
import { canClick } from "../shared/clicker-rules";

const events = ClickerNetwork.createServer({});

/** Owns every player's click count. Clients ask to click; this service decides. */
@Service()
export class ClickerService implements OnStart {
	private readonly clicks = new Map<Player, number>();
	private readonly lastClickAt = new Map<Player, number>();

	onStart() {
		events.click.connect((player) => {
			this.handleClick(player);
		});
		Players.PlayerRemoving.Connect((player) => {
			this.clicks.delete(player);
			this.lastClickAt.delete(player);
		});
	}

	getClicks(player: Player): number {
		return this.clicks.get(player) ?? 0;
	}

	private handleClick(player: Player) {
		const now = os.clock();
		if (!canClick(this.lastClickAt.get(player), now)) return;

		this.lastClickAt.set(player, now);
		const clicks = this.getClicks(player) + 1;
		this.clicks.set(player, clicks);
		events.clicksChanged.fire(player, clicks);
	}
}
