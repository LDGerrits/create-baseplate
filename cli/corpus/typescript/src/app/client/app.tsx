import { Dependency } from "@flamework/core";
import React from "@rbxts/react";
import { type DailyRewardController } from "../../features/daily-reward/client/daily-reward-controller";
import { DailyRewardPanel } from "../../features/daily-reward/client/daily-reward-panel";

export function App() {
	const dailyReward = Dependency<DailyRewardController>();
	return (
		<screengui ResetOnSpawn={false}>
			<frame
				AnchorPoint={new Vector2(1, 0.5)}
				Position={UDim2.fromScale(1, 0.5)}
				Size={UDim2.fromOffset(220, 60)}
				BackgroundTransparency={1}
			>
				<DailyRewardPanel controller={dailyReward} />
			</frame>
		</screengui>
	);
}
