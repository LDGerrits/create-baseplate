import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { CreateReactStory } from "@rbxts/ui-labs";
import { DailyRewardButton } from "./daily-reward-button";
import { dailyRewardFrom } from "./daily-reward-controller";

export = CreateReactStory({ react: React, reactRoblox: ReactRoblox, controls: { secondsLeft: 0 } }, ({ controls }) => (
	<frame Size={UDim2.fromOffset(220, 60)} BackgroundTransparency={1}>
		<DailyRewardButton
			reward={dailyRewardFrom(controls.secondsLeft)}
			onClaim={() => {
				print("claimed");
			}}
		/>
	</frame>
));
