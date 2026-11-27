// src/app/client/ui-controller.tsx
import { Controller, type OnStart } from "@flamework/core";
import React, { StrictMode } from "@rbxts/react";
import { createPortal, createRoot } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { App } from "./app";

@Controller()
export class UiController implements OnStart {
	onStart() {
		const root = createRoot(new Instance("Folder"));
		root.render(<StrictMode>{createPortal(<App />, Players.LocalPlayer.WaitForChild("PlayerGui"))}</StrictMode>);
	}
}
