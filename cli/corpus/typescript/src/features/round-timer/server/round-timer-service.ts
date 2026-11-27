import { type OnStart, Service } from "@flamework/core";
import { RunService } from "@rbxts/services";
import { RoundTimerNetwork } from "../shared/round-timer-network";

export const ROUND_SECONDS = 120;

const events = RoundTimerNetwork.createServer({});

/** Counts each round down and tells every player each whole second, checked every frame. */
@Service()
export class RoundTimerService implements OnStart {
	private left = ROUND_SECONDS;
	private shown = ROUND_SECONDS;

	onStart() {
		RunService.Heartbeat.Connect((deltaTime) => {
			const shown = this.step(deltaTime);
			if (shown !== undefined) events.tick.broadcast(shown);
		});
	}

	/** Advances the round by `deltaTime`; returns the whole seconds left when they changed. */
	step(deltaTime: number): number | undefined {
		this.left -= deltaTime;
		if (this.left <= 0) this.left += ROUND_SECONDS;
		const shown = math.ceil(this.left);
		if (shown === this.shown) return undefined;
		this.shown = shown;
		return shown;
	}
}
