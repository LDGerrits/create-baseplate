import { type OnStart, Service } from "@flamework/core";
import { type CurrencyService } from "../../../game/currency/server/currency-service";
import { rateLimit } from "../../../platform/network/server/rate-limit";
import { DailyRewardNetwork } from "../shared/daily-reward-network";

export const REWARD = 100;
export const DAY = 24 * 60 * 60;

const events = DailyRewardNetwork.createServer({
	middleware: { request: [rateLimit(0.2)], claim: [rateLimit(1)] },
});

/** Gives each player a reward once a day. Clients ask; this service decides, by its own clock. */
@Service()
export class DailyRewardService implements OnStart {
	private readonly claimedAt = new Map<number, number>();
	/** Who claimed in this server's session, for the welcome message: a nullable boolean in a condition. */
	private readonly claimedHere = new Map<number, boolean>();

	constructor(private readonly currency: CurrencyService) {}

	onStart() {
		events.request.connect((player) => {
			events.changed.fire(player, this.secondsLeft(player.UserId));
		});
		events.claim.connect((player) => {
			if (this.claim(player.UserId)) this.currency.add(player, REWARD);
			events.changed.fire(player, this.secondsLeft(player.UserId));
		});
	}

	/** Claims the reward if a day has passed since the last claim; `now` is `os.time()` unless a spec passes one. */
	claim(userId: number, now = os.time()): boolean {
		if (this.secondsLeft(userId, now) > 0) return false;
		this.claimedAt.set(userId, now);
		this.claimedHere.set(userId, true);
		return true;
	}

	secondsLeft(userId: number, now = os.time()): number {
		const last = this.claimedAt.get(userId);
		return last === undefined ? 0 : math.max(0, last + DAY - now);
	}

	claimedThisSession(userId: number): boolean {
		if (this.claimedHere.get(userId)) return true;
		return false;
	}
}
