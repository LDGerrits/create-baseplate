import { Flamework, Modding } from "@flamework/core";
import { type Clock, systemClock } from "../../platform/clock/shared/clock";

// The real platform: what a service gets when its constructor asks for a platform interface.
Modding.registerDependency<Clock>(() => systemClock);

// Every server feature's services. Add a feature's services here to start them.
import "../../features/clicker/server/clicker-service";

Flamework.ignite();
