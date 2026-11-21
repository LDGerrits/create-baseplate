import { Controller, type OnStart } from "@flamework/core";
import { store } from "../../../store/client-store";
import { ClickerNetwork } from "../shared/clicker-network";

const events = ClickerNetwork.createClient({});

/** Sends click requests, and puts the server's latest count in the store for the UI. */
@Controller()
export class ClickerController implements OnStart {
	onStart() {
		events.clicksChanged.connect((clicks) => store.setClicks(clicks));
	}

	click() {
		events.click.fire();
	}
}
