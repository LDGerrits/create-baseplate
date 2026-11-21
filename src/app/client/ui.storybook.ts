import { type Storybook } from "@rbxts/ui-labs";

// Lists this game's stories in the UI Labs plugin. Every feature's client folder ends up under
// StarterPlayerScripts.features, beside this script's folder.
const features = script.Parent?.Parent?.FindFirstChild("features");

export = {
	name: "agent-baseplate",
	storyRoots: features ? [features] : [],
} satisfies Storybook;
