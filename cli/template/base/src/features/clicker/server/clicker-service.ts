import { type OnStart, Service } from "@flamework/core";
import { Players } from "@rbxts/services";
import { rateLimit } from "../../../network/server/rate-limit";
import { ClickerNetwork } from "../shared/clicker-network";

/** Seconds a player waits between counted clicks. */
export const CLICK_COOLDOWN_SECONDS = 0.1;

// Every client-to-server event needs middleware, or the check fails: the rate limit drops floods
// before they reach the service, which still applies its own cooldown.
const events = ClickerNetwork.createServer({ middleware: { click: [rateLimit(20)] } });

/** Owns every player's click count. Clients ask to click; this service decides. */
@Service()
export class ClickerService implements OnStart {
	private readonly clicks = new Map<number, number>();
	private readonly lastClickAt = new Map<number, number>();

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

	/**
	 * Counts a click unless it comes inside the cooldown. Returns the new count, or `undefined` when refused.
	 * `now` is in `os.clock()` seconds; a test passes its own.
	 */
	click(userId: number, now = os.clock()): number | undefined {
		const last = this.lastClickAt.get(userId);
		if (last !== undefined && now - last < CLICK_COOLDOWN_SECONDS) return undefined;

		this.lastClickAt.set(userId, now);
		const clicks = this.getClicks(userId) + 1;
		this.clicks.set(userId, clicks);
		return clicks;
	}
}
