import { Dependency } from "@flamework/core";
import Vide, { cleanup, source } from "@rbxts/vide";
import { ClickerButton } from "../../features/clicker/client/clicker-button";
import { type ClickerController } from "../../features/clicker/client/clicker-controller";

/** The root of the player's UI. */
export function App() {
	const clicker = Dependency<ClickerController>();
	const clicks = source(clicker.getClicks());
	cleanup(clicker.subscribe(clicks));

	return (
		<screengui ResetOnSpawn={false} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
			<ClickerButton
				clicks={clicks}
				onClick={() => {
					clicker.click();
				}}
			/>
		</screengui>
	);
}
