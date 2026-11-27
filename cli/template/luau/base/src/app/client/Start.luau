local controllers: { { start: () -> () } } = {}

local Start = {}

function Start.start()
	for _, controller in controllers do
		controller.start()
	end
end

return Start
