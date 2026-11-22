-- Shows the click count and reports presses. Takes everything as props, so its story renders it alone.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local React = require(ReplicatedStorage.Packages.React)
local ReactRipple = require(ReplicatedStorage.Packages.ReactRipple)

export type Props = {
	clicks: number,
	onClick: () -> (),
}

local function ClickerButton(props: Props)
	-- A Ripple spring shrinks the button on each press and springs it back. `useSpring` returns it
	-- with a binding, so the animation updates the instance without re-rendering.
	local scale, spring = ReactRipple.useSpring(1, { tension = 500, friction = 15 })

	return React.createElement("TextButton", {
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -24),
		Size = UDim2.fromOffset(200, 50),
		Text = `Clicks: {props.clicks}`,
		[React.Event.Activated] = function()
			spring:setGoal(1, { position = 0.85 })
			props.onClick()
		end,
	}, {
		Scale = React.createElement("UIScale", { Scale = scale }),
	})
end

return ClickerButton
