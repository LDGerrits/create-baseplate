-- Shows the click count and reports presses. Takes everything as props, so its story renders it alone.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Vide = require(ReplicatedStorage.Packages.Vide)
local VideRipple = require(ReplicatedStorage.Packages.VideRipple)

local create = Vide.create

export type Props = {
	-- The count to show, read by calling it: a Vide source, so the text follows it.
	clicks: () -> number,
	onClick: () -> (),
}

local function ClickerButton(props: Props)
	-- A Ripple spring shrinks the button on each press and springs it back. `useSpring` returns its
	-- value as a source, so the animation updates the instance and nothing runs the component again.
	local scale, spring = VideRipple.useSpring(1, { tension = 500, friction = 15 })

	return create("TextButton")({
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -24),
		Size = UDim2.fromOffset(200, 50),
		TextSize = 20,
		Text = function()
			return `Clicks: {props.clicks()}`
		end,
		Activated = function()
			spring:setGoal(1, { position = 0.85 })
			props.onClick()
		end,

		create("UIScale")({ Scale = scale }),
	})
end

return ClickerButton
