/** What the game saves for each player. Add fields here; players who saved before get their defaults. */
export interface PlayerData {
	coins: number;
}

export const DEFAULT_PLAYER_DATA: PlayerData = {
	coins: 0,
};
