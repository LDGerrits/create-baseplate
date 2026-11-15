import { Controller, type OnStart } from "@flamework/core";
import { ClickerNetwork } from "../shared/clicker-network";
import { clicks } from "./clicker-state";

const events = ClickerNetwork.createClient({});

/** Sends click requests and mirrors the server's count into `clicks`. */
@Controller()
export class ClickerController implements OnStart {
	onStart() {
		events.clicksChanged.connect((count) => {
			clicks(count);
		});
	}

	click() {
		events.click.fire();
	}
}
