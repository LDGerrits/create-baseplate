-- The server's entry script: loads every service, then starts each. Add a feature's services to
-- the list to start them; the check fails on a service that isn't here.

local ServerScriptService = game:GetService("ServerScriptService")

local services: { { start: () -> () } } = {
	require(ServerScriptService.game.currency.CurrencyService),
	require(ServerScriptService.features.coinpickup.CoinPickupService),
	require(ServerScriptService.features.dailyreward.DailyRewardService),
	require(ServerScriptService.features.roundtimer.RoundTimerService),
	require(ServerScriptService.features.leaderboard.LeaderboardService),
}

for _, service in services do
	service.start()
end
