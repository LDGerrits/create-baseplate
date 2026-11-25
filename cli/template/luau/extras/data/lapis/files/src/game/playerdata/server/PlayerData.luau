-- What the game saves for each player. To add a field, add it to the type and to DEFAULT, to
-- `validate` in PlayerDataService.luau, and to a migration there that adds it to data saved before.
export type PlayerData = {
	coins: number,
}

local DEFAULT: PlayerData = {
	coins = 0,
}

return {
	DEFAULT = DEFAULT,
}
