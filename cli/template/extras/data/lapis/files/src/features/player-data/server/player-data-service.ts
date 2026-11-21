import { type OnStart, Service } from "@flamework/core";
import { type Collection, createCollection, type Document, setConfig } from "@rbxts/lapis";
import DataStoreServiceMock from "@rbxts/lapis-mockdatastore";
import { Players, RunService } from "@rbxts/services";
import { t } from "@rbxts/t";
import { DEFAULT_PLAYER_DATA, type PlayerData } from "./player-data";

// Studio saves to a mock DataStore, which forgets everything when the server stops.
if (RunService.IsStudio()) setConfig({ dataStoreService: new DataStoreServiceMock() });

const validate = t.strictInterface({ coins: t.number });
const newCollection = (name: string) =>
	createCollection<PlayerData>(name, { defaultData: DEFAULT_PLAYER_DATA, validate });

// Lapis allows one collection per name, so the game's is made once, on first use.
let gameCollection: Collection<PlayerData> | undefined;

/**
 * Loads each player's saved data when they join and saves it when they leave, with Lapis.
 * Other services read and change it through `get` and `update`.
 */
@Service()
export class PlayerDataService implements OnStart {
	private collection?: Collection<PlayerData>;
	private readonly documents = new Map<number, Document<PlayerData>>();

	/** A service over its own collection name, such as a spec's. Flamework constructs the game's own. */
	static withCollection(name: string) {
		const service = new PlayerDataService();
		service.collection = newCollection(name);
		return service;
	}

	onStart() {
		const join = (player: Player) => {
			this.load(player.UserId)
				.then((loaded) => {
					// The player may have left while their data loaded.
					if (player.Parent === undefined) this.release(player.UserId);
					else if (!loaded) player.Kick("Your data couldn't load. Please rejoin.");
				})
				.catch(warn);
		};
		// Players can join before this service starts, as in a Studio playtest.
		for (const player of Players.GetPlayers()) join(player);
		Players.PlayerAdded.Connect(join);
		Players.PlayerRemoving.Connect((player) => {
			this.release(player.UserId);
		});
	}

	/** Loads the player's document; resolves false when it couldn't. */
	async load(userId: number): Promise<boolean> {
		try {
			this.collection ??= gameCollection ??= newCollection("PlayerData");
			const document = await this.collection.load(`Player_${userId}`, [userId]);
			this.documents.set(userId, document);
			return true;
		} catch (reason) {
			warn(`Player ${userId}'s data didn't load: ${tostring(reason)}`);
			return false;
		}
	}

	/** The player's data, or undefined when it isn't loaded. */
	get(userId: number): Readonly<PlayerData> | undefined {
		return this.documents.get(userId)?.read();
	}

	/** Replaces the player's data with what `change` returns; false when it isn't loaded. */
	update(userId: number, change: (data: Readonly<PlayerData>) => PlayerData): boolean {
		const document = this.documents.get(userId);
		if (document === undefined) return false;
		document.write(change(document.read()));
		return true;
	}

	/** Saves the player's data and closes the document. */
	release(userId: number) {
		this.documents.get(userId)?.close().catch(warn);
		this.documents.delete(userId);
	}
}
