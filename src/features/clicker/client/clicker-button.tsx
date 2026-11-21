import React, { useBinding, useEffect, useMemo } from "@rbxts/react";
import { createSpring } from "@rbxts/ripple";

export interface ClickerButtonProps {
	readonly clicks: number;
	readonly onClick: () => void;
}

/** Shows the click count and reports presses. Takes everything as props, so its story renders it alone. */
export function ClickerButton({ clicks, onClick }: ClickerButtonProps) {
	// A Ripple spring shrinks the button on each press and lets it bounce back. It drives a
	// binding, not state, so the animation updates the instance without re-rendering.
	const [scale, setScale] = useBinding(1);
	const spring = useMemo(() => createSpring(1, { tension: 500, friction: 15 }), []);
	useEffect(() => {
		spring.start();
		const disconnect = spring.onChange((value) => {
			setScale(value);
		});
		return () => {
			disconnect();
			spring.stop();
		};
	}, [spring, setScale]);

	return (
		<textbutton
			AnchorPoint={new Vector2(0.5, 1)}
			Position={new UDim2(0.5, 0, 1, -24)}
			Size={UDim2.fromOffset(200, 50)}
			Text={`Clicks: ${clicks}`}
			Event={{
				Activated: () => {
					spring.setPosition(0.85);
					onClick();
				},
			}}
		>
			<uiscale Scale={scale} />
		</textbutton>
	);
}
