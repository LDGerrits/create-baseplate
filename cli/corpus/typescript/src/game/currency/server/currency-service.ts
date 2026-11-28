import { type OnStart, Service } from "@flamework/core";
import { Players } from "@rbxts/services";
import Signal from "@rbxutil/signal";

@Service()
export class CurrencyService implements OnStart {
	/** Fires with a player's new balance after every change. */
	readonly changed = new Signal<[player: Player, coins: number]>();
	private readonly counters = new Map<Player, IntValue>();

	onStart() {
		Players.PlayerAdded.Connect((player) => this.counterOf(player));
		Players.PlayerRemoving.Connect((player) => this.counters.delete(player));
		for (const player of Players.GetPlayers()) this.counterOf(player);
	}

	add(player: Player, amount: number) {
		const counter = this.counterOf(player);
		counter.Value += amount;
		this.changed.Fire(player, counter.Value);
	}

	getCoins(player: Player): number {
		return this.counters.get(player)?.Value ?? 0;
	}

	private counterOf(player: Player): IntValue {
		const existing = this.counters.get(player);
		if (existing) return existing;

		// Roblox's leaderboard shows the values in a player's folder named "leaderstats".
		const leaderstats = new Instance("Folder");
		leaderstats.Name = "leaderstats";
		const counter = new Instance("IntValue");
		counter.Name = "Coins";
		counter.Parent = leaderstats;
		leaderstats.Parent = player;
		this.counters.set(player, counter);
		return counter;
	}
}
