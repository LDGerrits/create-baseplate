import { type OnStart, Service } from "@flamework/core";
import ProfileStore from "@rbxts/profile-store";
import { Players, RunService } from "@rbxts/services";
import { DEFAULT_PLAYER_DATA, type PlayerData } from "./player-data";

type Store = ProfileStore.Store<PlayerData>["Mock"];
type Profile = ProfileStore.Profile<PlayerData>;

const STORE = ProfileStore.New("PlayerData", DEFAULT_PLAYER_DATA);

/**
 * Loads each player's saved data when they join and saves it when they leave, with ProfileStore.
 * Other services read and change it through `get` and `update`. Studio uses ProfileStore's mock
 * store, which forgets everything when the server stops.
 */
@Service()
export class PlayerDataService implements OnStart {
	private readonly profiles = new Map<number, Profile>();

	private store: Store = RunService.IsStudio() ? STORE.Mock : STORE;

	/** A service over another store, such as a spec's fresh mock. Flamework constructs the game's own. */
	static withStore(store: Store) {
		const service = new PlayerDataService();
		service.store = store;
		return service;
	}

	onStart() {
		Players.PlayerAdded.Connect((player) => {
			if (!this.load(player.UserId, () => player.Parent === undefined)) {
				player.Kick("Your data couldn't load. Please rejoin.");
			}
		});
		Players.PlayerRemoving.Connect((player) => {
			this.release(player.UserId);
		});
	}

	/** Starts the player's session; false when it couldn't, or when `cancel` says they left meanwhile. */
	load(userId: number, cancel: () => boolean = () => false): boolean {
		// The types say a profile always comes back, but it's nil when the session can't start or is cancelled.
		const profile = this.store.StartSessionAsync(`Player_${userId}`, { Cancel: cancel }) as Profile | undefined;
		if (profile === undefined) return false;
		profile.AddUserId(userId);
		profile.Reconcile();
		profile.OnSessionEnd.Connect(() => this.profiles.delete(userId));
		this.profiles.set(userId, profile);
		return true;
	}

	/** The player's data, or undefined when it isn't loaded. */
	get(userId: number): Readonly<PlayerData> | undefined {
		return this.profiles.get(userId)?.Data;
	}

	/** Replaces the player's data with what `change` returns; false when it isn't loaded. */
	update(userId: number, change: (data: Readonly<PlayerData>) => PlayerData): boolean {
		const profile = this.profiles.get(userId);
		if (profile === undefined) return false;
		profile.Data = change(profile.Data);
		return true;
	}

	/** Saves the player's data and ends the session. */
	release(userId: number) {
		this.profiles.get(userId)?.EndSession();
		this.profiles.delete(userId);
	}
}
