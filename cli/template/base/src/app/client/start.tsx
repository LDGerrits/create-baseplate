// First, before anything loads React.
import "./react-dev";

import { Flamework } from "@flamework/core";
import React, { StrictMode } from "@rbxts/react";
import { createPortal, createRoot } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { App } from "./app";

// Every client feature's controllers. Add a feature's controllers here to start them.
import "../../features/clicker/client/clicker-controller";

/** Starts the client: Flamework's controllers, then the UI. main.client.tsx calls it, and so does tests/e2e/clicker-ui.luau. */
export function start() {
	Flamework.ignite();

	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui");
	const root = createRoot(new Instance("Folder"));
	root.render(<StrictMode>{createPortal(<App />, playerGui)}</StrictMode>);
}
