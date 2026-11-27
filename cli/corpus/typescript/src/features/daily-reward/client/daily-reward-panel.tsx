import React, { useEffect, useState } from "@rbxts/react";
import { DailyRewardButton } from "./daily-reward-button";
import { type DailyRewardController } from "./daily-reward-controller";

/**
 * The button, kept current from the controller: React 17 has no useSyncExternalStore, so the
 * component takes the controller's value and subscribes to it in an effect.
 */
export function DailyRewardPanel({ controller }: { controller: DailyRewardController }) {
	const [reward, setReward] = useState(controller.reward);
	useEffect(() => {
		setReward(controller.reward);
		return controller.subscribe(setReward);
	}, [controller]);
	return (
		<DailyRewardButton
			reward={reward}
			onClaim={() => {
				controller.claim();
			}}
		/>
	);
}
