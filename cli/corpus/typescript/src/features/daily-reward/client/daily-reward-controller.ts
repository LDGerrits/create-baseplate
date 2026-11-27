import { Controller, type OnStart } from "@flamework/core";
import { DailyRewardNetwork } from "../shared/daily-reward-network";

const events = DailyRewardNetwork.createClient({});

/** Asks the server how long until the next claim, and keeps its latest answer for the UI. */
@Controller()
export class DailyRewardController implements OnStart {
	secondsLeft = -1;
	private readonly listeners = new Set<(secondsLeft: number) => void>();

	onStart() {
		events.changed.connect((secondsLeft) => {
			this.secondsLeft = secondsLeft;
			for (const listener of this.listeners) listener(secondsLeft);
		});
		events.request.fire();
	}

	/** Calls `listener` with each new answer; returns what stops it. */
	subscribe(listener: (secondsLeft: number) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	claim() {
		events.claim.fire();
	}
}
