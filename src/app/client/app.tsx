import { Dependency } from "@flamework/core";
import React, { useEffect, useState } from "@rbxts/react";
import { ClickerButton } from "../../features/clicker/client/clicker-button";
import { type ClickerController } from "../../features/clicker/client/clicker-controller";

/** The root of the player's UI. */
export function App() {
	const clicker = Dependency<ClickerController>();
	const [clicks, setClicks] = useState(clicker.getClicks());
	useEffect(() => clicker.subscribe(setClicks), [clicker]);

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
