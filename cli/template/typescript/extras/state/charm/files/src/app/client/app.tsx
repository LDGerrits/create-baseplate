import { Dependency } from "@flamework/core";
import React from "@rbxts/react";
import { useSignalState } from "@rbxts/react-charm";
import { ClickerButton } from "../../features/clicker/client/clicker-button";
import { type ClickerController } from "../../features/clicker/client/clicker-controller";

/** The root of the player's UI. */
export function App() {
	const clicker = Dependency<ClickerController>();
	const clicks = useSignalState(clicker.clicks);

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
