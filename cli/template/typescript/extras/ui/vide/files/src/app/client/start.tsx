import { Flamework } from "@flamework/core";
import { Players, RunService } from "@rbxts/services";
import Vide, { mount } from "@rbxts/vide";
import { App } from "./app";

// Every client feature's controllers. Add a feature's controllers here to start them.
import "../../features/clicker/client/clicker-controller";

/** Starts the client: Flamework's controllers, then the UI. main.client.tsx calls it, and so does tests/e2e/clicker-ui.luau. */
export function start() {
	// In Studio, Vide checks for mistakes and gives readable errors; live servers skip that cost.
	Vide.strict = RunService.IsStudio();

	Flamework.ignite();

	mount(() => <App />, Players.LocalPlayer.WaitForChild("PlayerGui"));
}
