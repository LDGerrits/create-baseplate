## Player data

`PlayerDataService` (`src/features/player-data/server/`) loads each player's saved data with Lapis (`@rbxts/lapis`) when they join, and saves it when they leave. Other services read it with `get(userId)` and change it with `update(userId, (data) => newData)`, getting the service through their constructor. Add saved fields to `PlayerData` and `DEFAULT_PLAYER_DATA` in `player-data.ts`; players who saved before get the new defaults. Studio saves to a mock store, forgotten when the server stops, and specs give the service their own (`player-data-service.spec.ts`).
