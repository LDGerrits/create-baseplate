import { Flamework } from "@flamework/core";
import { Players, RunService } from "@rbxts/services";
import Vide, { mount } from "@rbxts/vide";
import { App } from "./app";

// Every client feature's controllers. Add a feature's controllers here to start them.
import "../../features/clicker/client/clicker-controller";

// In Studio, Vide checks for mistakes and gives readable errors; live servers skip that cost.
Vide.strict = RunService.IsStudio();

Flamework.ignite();

mount(() => <App />, Players.LocalPlayer.WaitForChild("PlayerGui"));
