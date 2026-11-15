import { Dependency } from "@flamework/core";
import React from "@rbxts/react";
import { useAtom } from "@rbxts/react-charm";
import { type ClickerController } from "./clicker-controller";
import { clicks } from "./clicker-state";

export function ClickerButton() {
	const count = useAtom(clicks);
	const controller = Dependency<ClickerController>();

	return (
		<textbutton
			AnchorPoint={new Vector2(0.5, 1)}
			Position={new UDim2(0.5, 0, 1, -24)}
			Size={UDim2.fromOffset(200, 50)}
			Text={`Clicks: ${count}`}
			Event={{
				Activated: () => {
					controller.click();
				},
			}}
		/>
	);
}
