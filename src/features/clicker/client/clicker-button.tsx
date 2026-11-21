import React from "@rbxts/react";

export interface ClickerButtonProps {
	readonly clicks: number;
	readonly onClick: () => void;
}

/** Shows the click count and reports presses. Takes everything as props, so its story renders it alone. */
export function ClickerButton({ clicks, onClick }: ClickerButtonProps) {
	return (
		<textbutton
			AnchorPoint={new Vector2(0.5, 1)}
			Position={new UDim2(0.5, 0, 1, -24)}
			Size={UDim2.fromOffset(200, 50)}
			Text={`Clicks: ${clicks}`}
			Event={{ Activated: onClick }}
		/>
	);
}
