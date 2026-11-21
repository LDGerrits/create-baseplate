/**
 * What the game saves for each player. To add a field, add it here, in DEFAULT_PLAYER_DATA, in
 * `validate` in player-data-service.ts, and in a migration there that adds it to data saved before.
 */
export interface PlayerData {
	coins: number;
}

export const DEFAULT_PLAYER_DATA: PlayerData = {
	coins: 0,
};
