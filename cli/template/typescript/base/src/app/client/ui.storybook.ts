import { type Storybook } from "@rbxts/ui-labs";

// Lists this game's stories in the UI Labs plugin. The client folders of the features, game systems
// and platform modules end up under StarterPlayerScripts.features, .game and .platform, beside this
// script's folder, which holds the app's own stories.
const roots = [
	script.Parent,
	...["features", "game", "platform"].map((layer) => script.Parent?.Parent?.FindFirstChild(layer)),
].filterUndefined();

export = {
	name: "my-game",
	storyRoots: roots,
} satisfies Storybook;
