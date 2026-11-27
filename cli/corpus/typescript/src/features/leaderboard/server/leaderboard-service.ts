import { type OnStart, Service } from "@flamework/core";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- a leaderboard's ordered store, not player data
import { DataStoreService } from "@rbxts/services";

export function topScores(entries: { key: string; value: number }[], size: number) {
	return [...entries].sort((a, b) => a.value > b.value).filter((_, index) => index < size);
}

@Service()
export class LeaderboardService implements OnStart {
	private readonly store = DataStoreService.GetOrderedDataStore("Wins");

	onStart() {}

	recordWin(userId: number) {
		this.store.IncrementAsync(tostring(userId), 1);
	}
}
