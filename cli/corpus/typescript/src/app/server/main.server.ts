import { Flamework } from "@flamework/core";

import "../../game/currency/server/currency-service";
import "../../features/coin-pickup/server/coin-pickup-service";
import "../../features/daily-reward/server/daily-reward-service";
import "../../features/round-timer/server/round-timer-service";
import "../../features/leaderboard/server/leaderboard-service";

Flamework.ignite();
