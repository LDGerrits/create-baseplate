import { Controller, type OnStart } from "@flamework/core";
import { ClickerNetwork } from "../shared/clicker-network";

const events = ClickerNetwork.createClient({});

/** Sends click requests, and keeps the server's latest count for the UI. */
@Controller()
export class ClickerController implements OnStart {
	private clicks = 0;
	private readonly listeners = new Set<(clicks: number) => void>();

	onStart() {
		events.clicksChanged.connect((clicks) => {
			this.clicks = clicks;
			this.listeners.forEach((listener) => {
				listener(clicks);
			});
		});
	}

	getClicks() {
		return this.clicks;
	}

	/** Calls `listener` with each new count. Returns a function that stops it. */
	subscribe(listener: (clicks: number) => void) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	click() {
		events.click.fire();
	}
}
