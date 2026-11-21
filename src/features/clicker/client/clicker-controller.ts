import { Controller, type OnStart } from "@flamework/core";
import { atom } from "@rbxts/charm";
import { ClickerNetwork } from "../shared/clicker-network";

const events = ClickerNetwork.createClient({});

/** Sends click requests, and keeps the server's latest count in `clicks` for the UI. */
@Controller()
export class ClickerController implements OnStart {
	readonly clicks = atom(0);

	onStart() {
		events.clicksChanged.connect((count) => {
			this.clicks(count);
		});
	}

	click() {
		events.click.fire();
	}
}
