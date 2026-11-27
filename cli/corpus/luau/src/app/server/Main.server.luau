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
