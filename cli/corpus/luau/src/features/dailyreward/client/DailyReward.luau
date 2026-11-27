local DailyReward = {}

export type DailyReward = { status: "loading" } | { status: "ready" } | { status: "cooldown", secondsLeft: number }

function DailyReward.fromSecondsLeft(secondsLeft: number): DailyReward
	if secondsLeft <= 0 then
		return { status = "ready" }
	end
	return { status = "cooldown", secondsLeft = secondsLeft }
end

return DailyReward
