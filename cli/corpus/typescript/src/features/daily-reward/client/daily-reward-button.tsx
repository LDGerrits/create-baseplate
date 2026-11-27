import React from "@rbxts/react";

export interface DailyRewardButtonProps {
	/** Seconds until the next claim; 0 when the reward is ready, -1 while it loads. */
	secondsLeft: number;
	onClaim: () => void;
}

/** The claim button, or a countdown while the reward isn't ready. */
export function DailyRewardButton({ secondsLeft, onClaim }: DailyRewardButtonProps) {
	const ready = secondsLeft === 0;
	const text =
		secondsLeft < 0
			? "…"
			: ready
				? "Claim 100 coins"
				: string.format("%02d:%02d", math.floor(secondsLeft / 3600), math.floor((secondsLeft % 3600) / 60));
	return (
		<textbutton
			key="claim"
			Size={UDim2.fromOffset(200, 48)}
			Text={text}
			TextScaled={true}
			Active={ready}
			BackgroundColor3={ready ? Color3.fromRGB(70, 170, 90) : Color3.fromRGB(90, 90, 90)}
			Event={{
				Activated: () => {
					if (ready) onClaim();
				},
			}}
		/>
	);
}
