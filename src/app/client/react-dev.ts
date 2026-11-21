import { RunService } from "@rbxts/services";

declare global {
	interface _G {
		__DEV__?: boolean;
	}
}

// React reads __DEV__ once, when it first loads, so main.client.tsx imports this file before React.
// In Studio, React then checks hooks and keys and gives readable errors; live servers skip that cost.
_G.__DEV__ = RunService.IsStudio();
