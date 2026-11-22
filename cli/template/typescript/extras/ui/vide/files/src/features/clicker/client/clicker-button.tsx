import Vide, { spring } from "@rbxts/vide";

export interface ClickerButtonProps {
	/** The count to show; a Vide source, so the text updates when it changes. */
	readonly clicks: () => number;
	readonly onClick: () => void;
}

/** Shows the click count and reports presses. Takes everything as props, so its story renders it alone. */
export function ClickerButton({ clicks, onClick }: ClickerButtonProps) {
	// A spring shrinks the button on each press and lets it bounce back to full size.
	const [scale, setScale] = spring((): number => 1, 0.25, 0.4);

	return (
		<textbutton
			AnchorPoint={new Vector2(0.5, 1)}
			Position={new UDim2(0.5, 0, 1, -24)}
			Size={UDim2.fromOffset(200, 50)}
			Text={() => `Clicks: ${clicks()}`}
			TextSize={20}
			Activated={() => {
				setScale({ position: 0.85 });
				onClick();
			}}
		>
			<uiscale Scale={scale} />
		</textbutton>
	);
}
