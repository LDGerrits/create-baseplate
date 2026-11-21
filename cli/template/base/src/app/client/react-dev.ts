import { backend } from "@rbxts/react-devtools-core";
import ReactGlobals from "@rbxts/react-globals";
import { RunService, Workspace } from "@rbxts/services";

// React reads these flags once, when it first loads, so main.client.tsx imports this file before React.
// In Studio, React checks hooks and keys and gives readable errors; live servers skip that cost.
ReactGlobals.__DEV__ = RunService.IsStudio();

// To inspect the UI's components, props and state, run the React DevTools app (`npx react-devtools`)
// and set the attribute `ReactDevTools` to true on Workspace in Studio before you play.
if (RunService.IsStudio() && Workspace.GetAttribute("ReactDevTools") === true) {
	ReactGlobals.__PROFILE__ = true;
	backend.connectToDevtools();
}
