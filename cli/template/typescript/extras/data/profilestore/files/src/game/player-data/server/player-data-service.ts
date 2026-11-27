import { type OnStart, Service } from "@flamework/core";
import ProfileStore from "@rbxts/profile-store";
import { Players, RunService } from "@rbxts/services";
import { DEFAULT_PLAYER_DATA, type PlayerData } from "./player-data";

type Store = ProfileStore.Store<PlayerData>["Mock"];
type Profile = ProfileStore.Profile<PlayerData>;

const STORE = ProfileStore.New("PlayerData", DEFAULT_PLAYER_DATA);

@Service()
export class PlayerDataService implements OnStart {
	private readonly profiles = new Map<number, Profile>();

	private store: Store = RunService.IsStudio() ? STORE.Mock : STORE;

	static withStore(store: Store) {
		const service = new PlayerDataService();
		service.store = store;
		return service;
	}

	onStart() {
		const join = (player: Player) => {
			const hasLeft = () => player.Parent === undefined;
			const loaded = this.load(player.UserId, hasLeft);
			if (hasLeft()) this.release(player.UserId);
			else if (!loaded) player.Kick("Your data couldn't load. Please rejoin.");
		};
		// Players can join before this service starts, as in a Studio playtest.
		for (const player of Players.GetPlayers()) task.spawn(join, player);
		Players.PlayerAdded.Connect(join);
		Players.PlayerRemoving.Connect((player) => {
			this.release(player.UserId);
		});
	}

	load(userId: number, cancel: () => boolean = () => false): boolean {
		// The types say a profile always comes back, but it's nil when the session can't start or is cancelled.
		const profile = this.store.StartSessionAsync(`Player_${userId}`, { Cancel: cancel }) as Profile | undefined;
		if (profile === undefined) return false;
		profile.AddUserId(userId);
		profile.Reconcile();
		profile.OnSessionEnd.Connect(() => {
			const releasedHere = this.profiles.get(userId) !== profile;
			if (releasedHere) return;
			this.profiles.delete(userId);
			// The session ended without a release, as when another server took it: the player's
			// changes would no longer save, so they rejoin with the latest data.
			Players.GetPlayerByUserId(userId)?.Kick("Your data was loaded on another server. Please rejoin.");
		});
		this.profiles.set(userId, profile);
		return true;
	}

	get(userId: number): Readonly<PlayerData> | undefined {
		return this.profiles.get(userId)?.Data;
	}

	update(userId: number, change: (data: Readonly<PlayerData>) => PlayerData): boolean {
		const profile = this.profiles.get(userId);
		if (profile === undefined) return false;
		profile.Data = change(profile.Data);
		return true;
	}

	release(userId: number) {
		const profile = this.profiles.get(userId);
		this.profiles.delete(userId);
		profile?.EndSession();
	}
}
