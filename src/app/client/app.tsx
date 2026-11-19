import React from "@rbxts/react";
import { ClickerButton } from "../../features/clicker/client/clicker-button";
import { useClicker } from "../../features/clicker/client/use-clicker";

/** The root of the player's UI: each feature's hook feeds its top-level view. */
export function App() {
	const clicker = useClicker();

	return (
		<screengui ResetOnSpawn={false} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
			<ClickerButton clicks={clicker.clicks} onClick={clicker.click} />
		</screengui>
	);
}
