import { CreateVideStory, Number } from "@rbxts/ui-labs";
import Vide from "@rbxts/vide";
import { ClickerButton } from "./clicker-button";

/** `mise run ui` renders this with rur; in Studio, the UI Labs plugin shows it with its controls. */
export = CreateVideStory(
	{
		vide: Vide,
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
