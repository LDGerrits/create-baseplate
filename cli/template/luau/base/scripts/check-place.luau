--!strict
-- Opens a built place and checks what the type checker can't: that no code a client can see
-- reaches for a server-only service. luau-lsp resolves every require through sourcemap.json, but
-- `require(ServerScriptService.X)` type-checks in a client module too, and only fails in game,
-- where ServerScriptService and ServerStorage are empty on clients. Packages are left out. It also
-- warns of instances Open Cloud's place publishing doesn't update.
--
-- Usage: lune run scripts/check-place <place.rbxl>

local fs = require("@lune/fs")
local process = require("@lune/process")
local roblox = require("@lune/roblox")

type Instance = roblox.Instance

local placePath = process.args[1]
if placePath == nil then
	print("usage: lune run scripts/check-place <place.rbxl>")
	process.exit(2)
end

local game = roblox.deserializePlace(fs.readFile(placePath))

-- Where clients can see code: what replicates, and what each player gets a copy of.
local CLIENT_VISIBLE =
	{ "ReplicatedStorage", "ReplicatedFirst", "StarterPlayer", "StarterGui", "StarterPack", "Workspace" }
local SERVER_ONLY = { "ServerScriptService", "ServerStorage" }
local PACKAGES = { Packages = true, DevPackages = true, ServerPackages = true }

local function inPackages(instance: Instance): boolean
	local current: Instance? = instance
	while current ~= nil do
		if PACKAGES[current.Name] then
			return true
		end
		current = current.Parent
	end
	return false
end

local problems = {}
for _, serviceName in CLIENT_VISIBLE do
	local service = game:FindFirstChild(serviceName)
	if service == nil then
		continue
	end
	for _, descendant in service:GetDescendants() do
		if not descendant:IsA("LuaSourceContainer") or inPackages(descendant) then
			continue
		end
		local isServerScript = descendant.ClassName == "Script"
			and (descendant :: any).RunContext ~= Enum.RunContext.Client
		if isServerScript then
			continue
		end
		local source = (descendant :: any).Source :: string
		for _, serverOnly in SERVER_ONLY do
			-- game:GetService("X"), game:GetService "X", game:FindService("X"), game.X, game["X"]
			local reached = string.find(source, `[GF][ei][tn]d?Service%s*%(?%s*["']{serverOnly}["']`)
				or string.find(source, `game%s*%.%s*{serverOnly}%f[^%w_]`)
				or string.find(source, `game%s*%[%s*["']{serverOnly}["']%s*%]`)
			if reached then
				table.insert(
					problems,
					`{descendant:GetFullName()} reaches {serverOnly}, which is empty on clients. Move the code it needs into a shared/ folder, or this file into a server/ one.`
				)
			end
		end
	end
end

-- Open Cloud's place publishing doesn't update these classes, so after changing one, publish from
-- Studio. Unions are PartOperations; WrapLayer, WrapTarget and WrapDeformer are BaseWraps.
local UNPUBLISHABLE = { "PartOperation", "BaseWrap", "SurfaceAppearance", "EditableImage", "EditableMesh" }
for _, descendant in game:GetDescendants() do
	for _, class in UNPUBLISHABLE do
		if descendant:IsA(class) then
			print(
				`! {descendant:GetFullName()} is a {descendant.ClassName}: Open Cloud's place publishing doesn't update these, so after changing it, publish from Studio (create.roblox.com/docs/cloud/guides/usage-place-publishing).`
			)
			break
		end
	end
end

if #problems > 0 then
	for _, problem in problems do
		print(`✗ {problem}`)
	end
	process.exit(1)
end
