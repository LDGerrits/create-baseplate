-- The seconds until the next claim, or "Claim" when the reward is ready.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local React = require(ReplicatedStorage.Packages.React)

export type Props = { count: number }

local function Counter(props: Props)
	return React.createElement("TextLabel", {
		Size = UDim2.fromOffset(200, 48),
		Text = if props.count == 0 then "Claim" else `{props.count} s`,
		TextScaled = true,
	})
end

return Counter
