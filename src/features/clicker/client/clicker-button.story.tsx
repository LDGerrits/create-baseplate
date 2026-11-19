import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { ClickerButton } from "./clicker-button";

const controls = { clicks: 0 };

/** A UI Labs story: `mise run ui` renders it with rur, and the UI Labs plugin shows it in Studio. */
export = {
	react: React,
	reactRoblox: ReactRoblox,
	controls,
	story: (props: { controls: typeof controls }) => (
		<ClickerButton
			clicks={props.controls.clicks}
			onClick={() => {
				print("clicked");
			}}
		/>
	),
};
