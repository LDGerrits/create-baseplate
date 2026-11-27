local RunService = game:GetService("RunService")

local TURNS_PER_SECOND = 0.5

local CoinPickupController = {}

function CoinPickupController.start()
	RunService.RenderStepped:Connect(function(deltaTime)
		-- Looked up every frame: streaming can remove the coin and bring it back.
		local coin = workspace:FindFirstChild("Coin")
		if coin and coin:IsA("BasePart") then
			local turn = CFrame.Angles(0, deltaTime * TURNS_PER_SECOND * math.pi * 2, 0)
			coin.CFrame = CFrame.new(coin.Position) * turn * coin.CFrame.Rotation
		end
	end)
end

return CoinPickupController
