import { Dependency } from "@flamework/core";
import React from "@rbxts/react";
import { ReflexProvider, useSelector } from "@rbxts/react-reflex";
import { ClickerButton } from "../../features/clicker/client/clicker-button";
import { type ClickerController } from "../../features/clicker/client/clicker-controller";
import { type RootState, store } from "../../store/client-store";

function Hud() {
	const clicker = Dependency<ClickerController>();
	const clicks = useSelector((state: RootState) => state.clicker.clicks);

	return (
		<ClickerButton
			clicks={clicks}
			onClick={() => {
				clicker.click();
			}}
		/>
	);
}

/** The root of the player's UI. */
export function App() {
	return (
		<ReflexProvider producer={store}>
			<screengui ResetOnSpawn={false} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
				<Hud />
			</screengui>
		</ReflexProvider>
	);
}
