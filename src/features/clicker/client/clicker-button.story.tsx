import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { CreateReactStory, Number } from "@rbxts/ui-labs";
import { ClickerButton } from "./clicker-button";

/** `mise run ui` renders this with rur; in Studio, the UI Labs plugin shows it with its controls. */
export = CreateReactStory(
	{
		react: React,
		reactRoblox: ReactRoblox,
		controls: { clicks: Number(0, 0) },
	},
	(props) => (
		<ClickerButton
			clicks={props.controls.clicks}
			onClick={() => {
				print("clicked");
			}}
		/>
	),
);
