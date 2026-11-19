import { type OnStart, Service } from "@flamework/core";
import { Players } from "@rbxts/services";
import { type Clock } from "../../../platform/clock/shared/clock";
import { ClickerNetwork } from "../shared/clicker-network";
import { canClick } from "../shared/clicker-rules";

const events = ClickerNetwork.createServer({});

/** Owns every player's click count. Clients ask to click; this service decides. */
@Service()
export class ClickerService implements OnStart {
	private readonly clicks = new Map<number, number>();
	private readonly lastClickAt = new Map<number, number>();

	constructor(private readonly clock: Clock) {}

	onStart() {
		events.click.connect((player) => {
			const clicks = this.click(player.UserId);
			if (clicks !== undefined) events.clicksChanged.fire(player, clicks);
		});
		Players.PlayerRemoving.Connect((player) => {
			this.clicks.delete(player.UserId);
			this.lastClickAt.delete(player.UserId);
		});
	}

	getClicks(userId: number): number {
		return this.clicks.get(userId) ?? 0;
	}

	/** Counts a click if the cooldown allows it. Returns the new count, or `undefined` when refused. */
	click(userId: number): number | undefined {
		const now = this.clock.now();
		if (!canClick(this.lastClickAt.get(userId), now)) return undefined;

		this.lastClickAt.set(userId, now);
		const clicks = this.getClicks(userId) + 1;
		this.clicks.set(userId, clicks);
		return clicks;
	}
}
