-- What the game saves for each player. Add fields to the type and to DEFAULT; players who saved
-- before get their defaults.
export type PlayerData = {
	coins: number,
}

local DEFAULT: PlayerData = {
	coins = 0,
}

return {
	DEFAULT = DEFAULT,
}
