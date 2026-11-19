import { Dependency } from "@flamework/core";
import { useAtom } from "@rbxts/react-charm";
import { type ClickerController } from "./clicker-controller";
import { clicks } from "./clicker-state";

/** Connects the clicker's views to the game: the count to show, and what a press does. */
export function useClicker() {
	const controller = Dependency<ClickerController>();
	return {
		clicks: useAtom(clicks),
		click: () => {
			controller.click();
		},
	};
}
