-- The server's entry script: loads every service, then starts each. Add a feature's services to
-- the list to start them; the check fails on a service that isn't here.

local services: { { start: () -> () } } = {}

for _, service in services do
	service.start()
end
