-- Starts the client: every controller. Main.client.luau calls it, and so can tests. Add a feature's
-- controllers to the list to start them; the check fails on a controller that isn't here.

local controllers: { { start: () -> () } } = {}

local Start = {}

function Start.start()
	for _, controller in controllers do
		controller.start()
	end
end

return Start
