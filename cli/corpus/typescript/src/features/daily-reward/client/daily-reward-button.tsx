import React from "@rbxts/react";
import { type DailyReward } from "./daily-reward-controller";

export interface DailyRewardButtonProps {
	reward: DailyReward;
	onClaim: () => void;
}

const labelOf = (reward: DailyReward) => {
	switch (reward.status) {
		case "loading":
			return "…";
		case "ready":
			return "Claim 100 coins";
		case "cooldown":
			return string.format(
				"%02d:%02d",
				math.floor(reward.secondsLeft / 3600),
				math.floor((reward.secondsLeft % 3600) / 60),
			);
	}
};

export function DailyRewardButton({ reward, onClaim }: DailyRewardButtonProps) {
	const ready = reward.status === "ready";
	const text = labelOf(reward);
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
