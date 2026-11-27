import { Controller, type OnStart } from "@flamework/core";
import { DailyRewardNetwork } from "../shared/daily-reward-network";

export type DailyReward = { status: "loading" } | { status: "ready" } | { status: "cooldown"; secondsLeft: number };

export const dailyRewardFrom = (secondsLeft: number): DailyReward =>
	secondsLeft <= 0 ? { status: "ready" } : { status: "cooldown", secondsLeft };

const events = DailyRewardNetwork.createClient({});

@Controller()
export class DailyRewardController implements OnStart {
	reward: DailyReward = { status: "loading" };
	private readonly listeners = new Set<(reward: DailyReward) => void>();

	onStart() {
		events.changed.connect((secondsLeft) => {
			this.reward = dailyRewardFrom(secondsLeft);
			for (const listener of this.listeners) listener(this.reward);
		});
		events.request.fire();
	}

	subscribe(listener: (reward: DailyReward) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	claim() {
		events.claim.fire();
	}
}
