import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { CreateReactStory } from "@rbxts/ui-labs";
import { type DailyRewardController } from "./daily-reward-controller";
import { DailyRewardPanel } from "./daily-reward-panel";

const controller = {
	reward: { status: "cooldown", secondsLeft: 3700 },
	subscribe() {
		return () => {};
	},
	claim() {},
} as unknown as DailyRewardController;

export = CreateReactStory({ react: React, reactRoblox: ReactRoblox }, () => (
	<frame Size={UDim2.fromOffset(220, 60)} BackgroundTransparency={1}>
		<DailyRewardPanel controller={controller} />
	</frame>
));
