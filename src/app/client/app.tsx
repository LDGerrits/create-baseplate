import React from "@rbxts/react";
import { ClickerButton } from "../../features/clicker/client/clicker-button";

/** The root of the player's UI. Each feature's top-level UI goes here. */
export function App() {
	return (
		<screengui ResetOnSpawn={false} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
			<ClickerButton />
		</screengui>
	);
}
