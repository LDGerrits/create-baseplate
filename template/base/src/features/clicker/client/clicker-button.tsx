import { useMotion } from "@rbxts/pretty-react-hooks";
import React from "@rbxts/react";

export interface ClickerButtonProps {
	readonly clicks: number;
	readonly onClick: () => void;
}

/** Shows the click count and reports presses. Takes everything as props, so its story renders it alone. */
export function ClickerButton({ clicks, onClick }: ClickerButtonProps) {
	// A Ripple motion shrinks the button on each press and springs it back. `useMotion` returns it
	// with a binding, so the animation updates the instance without re-rendering.
	const [scale, scaleMotion] = useMotion(1);

	return (
		<textbutton
			AnchorPoint={new Vector2(0.5, 1)}
			Position={new UDim2(0.5, 0, 1, -24)}
			Size={UDim2.fromOffset(200, 50)}
			Text={`Clicks: ${clicks}`}
			Event={{
				Activated: () => {
					scaleMotion.immediate(0.85);
					scaleMotion.spring(1, { tension: 500, friction: 15 });
					onClick();
				},
			}}
		>
			<uiscale Scale={scale} />
		</textbutton>
	);
}
