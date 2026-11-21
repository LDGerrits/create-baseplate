import { signal } from "@rbxts/charm";
import { Controller, type OnStart } from "@flamework/core";
import { ClickerNetwork } from "../shared/clicker-network";

const events = ClickerNetwork.createClient({});

/** Sends click requests, and keeps the server's latest count in a Charm signal for the UI. */
@Controller()
export class ClickerController implements OnStart {
	private readonly count = signal(0);
	/** The latest count. Read it in UI with `useSignalState(clicker.clicks)`. */
	readonly clicks = this.count[0];

	onStart() {
		const [, setClicks] = this.count;
		events.clicksChanged.connect((clicks) => setClicks(clicks));
	}

	click() {
		events.click.fire();
	}
}
