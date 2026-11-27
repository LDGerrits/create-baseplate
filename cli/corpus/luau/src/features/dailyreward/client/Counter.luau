local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Vide = require(ReplicatedStorage.Packages.Vide)

local DailyReward = require(script.Parent.DailyReward)

local create = Vide.create

export type Props = { reward: () -> DailyReward.DailyReward }

local function Counter(props: Props)
	return create("TextLabel")({
		Size = UDim2.fromOffset(200, 48),
		Text = function()
			local reward = props.reward()
			if reward.status == "cooldown" then
				return `{reward.secondsLeft} s`
			end
			return if reward.status == "ready" then "Claim" else "…"
		end,
		TextScaled = true,
	})
end

return Counter
