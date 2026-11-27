local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Vide = require(ReplicatedStorage.Packages.Vide)

local create = Vide.create

export type Props = { count: () -> number }

local function Counter(props: Props)
	return create("TextLabel")({
		Size = UDim2.fromOffset(200, 48),
		Text = function()
			local count = props.count()
			return if count == 0 then "Claim" else `{count} s`
		end,
		TextScaled = true,
	})
end

return Counter
