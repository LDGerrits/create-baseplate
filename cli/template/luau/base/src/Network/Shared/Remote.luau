-- Remotes, declared once in a feature's Shared/<Feature>Network.luau and used from both sides. The
-- server makes each RemoteEvent and RemoteFunction under ReplicatedStorage.Remotes as the
-- declaration loads; the client waits for it. Types only exist in Luau, so the declaration carries
-- the argument types for the type checker and a `check` that the server runs on what a client sends.
--
-- Client to server: `Remote.clientEvent` and `Remote.clientRequest`. The client calls `:fire(...)` or
-- `:invoke(...)`; the server takes them only through Network/Server/Serve.luau, which checks the
-- arguments and rate-limits each player.
-- Server to client: `Remote.serverEvent`. The server calls `:fire(player, ...)` or `:fireAll(...)`;
-- the client calls `:connect(handler)`.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

-- Whether a client's arguments are what the remote takes, such as `t.tuple(t.integer)`. Return
-- false and the call is dropped before any handler runs.
export type Check = (...any) -> boolean

export type ClientEvent<T...> = {
	name: string,
	instance: RemoteEvent,
	check: Check,
	-- Client: send the event to the server.
	fire: (self: ClientEvent<T...>, T...) -> (),
}

export type ClientRequest<T..., R...> = {
	name: string,
	instance: RemoteFunction,
	check: Check,
	-- Client: call the server and wait for its answer. A call the server drops (over the rate limit,
	-- or arguments its check refuses) answers nothing, so check for nil before using the answer.
	invoke: (self: ClientRequest<T..., R...>, T...) -> R...,
}

export type ServerEvent<T...> = {
	name: string,
	instance: RemoteEvent,
	-- Server: send to one player.
	fire: (self: ServerEvent<T...>, player: Player, T...) -> (),
	-- Server: send to every player.
	fireAll: (self: ServerEvent<T...>, T...) -> (),
	-- Client: run `handler` on each event. Returns the connection.
	connect: (self: ServerEvent<T...>, handler: (T...) -> ()) -> RBXScriptConnection,
}

local FOLDER = "Remotes"
-- How long a client waits for the server to make a remote before it says which one is missing.
local CLIENT_WAIT_SECONDS = 30

-- Which module declared each remote name. Names are global, so a second feature using one would
-- share the first's remote, and its client calls would reach both handlers.
local declaredBy: { [string]: string } = {}

local function remote(name: string, className: "RemoteEvent" | "RemoteFunction", declarer: string): Instance
	local first = declaredBy[name]
	if first ~= nil and first ~= declarer then
		error(`remote "{name}" is declared by both {first} and {declarer}: give each its own name`, 3)
	end
	declaredBy[name] = declarer

	if RunService:IsServer() then
		local folder = ReplicatedStorage:FindFirstChild(FOLDER)
		if folder == nil then
			folder = Instance.new("Folder")
			assert(folder).Name = FOLDER
			assert(folder).Parent = ReplicatedStorage
		end
		local existing = (folder :: Instance):FindFirstChild(name)
		if existing ~= nil then
			assert(existing.ClassName == className, `remote {name} is declared twice, as two kinds`)
			return existing
		end
		local created = Instance.new(className)
		created.Name = name
		created.Parent = folder
		return created
	end
	local folder = ReplicatedStorage:WaitForChild(FOLDER, CLIENT_WAIT_SECONDS)
	local found = if folder then folder:WaitForChild(name, CLIENT_WAIT_SECONDS) else nil
	if found == nil then
		error(
			`remote "{name}" never appeared: the server makes it when {declarer} loads, so a service that requires it must be listed in this place's Main.server.luau`,
			3
		)
	end
	return found
end

local Remote = {}

-- An event a client sends. `check` validates its arguments on the server.
function Remote.clientEvent<T...>(name: string, check: Check): ClientEvent<T...>
	local instance = remote(name, "RemoteEvent", debug.info(2, "s")) :: RemoteEvent
	return {
		name = name,
		instance = instance,
		check = check,
		fire = function(_self: ClientEvent<T...>, ...: T...)
			instance:FireServer(...)
		end,
	}
end

-- A request a client sends and waits on. `check` validates its arguments on the server.
function Remote.clientRequest<T..., R...>(name: string, check: Check): ClientRequest<T..., R...>
	local instance = remote(name, "RemoteFunction", debug.info(2, "s")) :: RemoteFunction
	return {
		name = name,
		instance = instance,
		check = check,
		invoke = function(_self: ClientRequest<T..., R...>, ...: T...): R...
			return instance:InvokeServer(...)
		end,
	}
end

-- An event the server sends.
function Remote.serverEvent<T...>(name: string): ServerEvent<T...>
	local instance = remote(name, "RemoteEvent", debug.info(2, "s")) :: RemoteEvent
	return {
		name = name,
		instance = instance,
		fire = function(_self: ServerEvent<T...>, player: Player, ...: T...)
			instance:FireClient(player, ...)
		end,
		fireAll = function(_self: ServerEvent<T...>, ...: T...)
			instance:FireAllClients(...)
		end,
		connect = function(_self: ServerEvent<T...>, handler: (T...) -> ()): RBXScriptConnection
			return instance.OnClientEvent:Connect(handler)
		end,
	}
end

return Remote
