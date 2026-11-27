import { Flamework } from "@flamework/core";

// Flamework starts each controller imported here; `mise run feature <name>` adds them.

import "../../features/coin-pickup/client/coin-pickup-controller";
import "../../features/daily-reward/client/daily-reward-controller";
import "./ui-controller";

Flamework.ignite();
