import { type OnStart, Service } from "@flamework/core";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- a leaderboard's ordered store, not player data
import { DataStoreService } from "@rbxts/services";

/** Ranks entries by score, highest first, at most `size` of them. */
export function topScores(entries: { key: string; value: number }[], size: number) {
	return [...entries].sort((a, b) => a.value > b.value).filter((_, index) => index < size);
}

/** Keeps the all-time wins in an ordered store, which no player data library covers. */
@Service()
export class LeaderboardService implements OnStart {
	private readonly store = DataStoreService.GetOrderedDataStore("Wins");

	onStart() {}

	recordWin(userId: number) {
		this.store.IncrementAsync(tostring(userId), 1);
	}
}
