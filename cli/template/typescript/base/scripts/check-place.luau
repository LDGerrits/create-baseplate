--!strict
-- Opens a built place and checks that every roblox-ts import in it resolves to
-- an instance, the way RuntimeLib resolves it in game. A missing package mount or
-- a file routed to the wrong side compiles fine but errors in Studio; this finds
-- it without opening Studio. It also warns of instances Open Cloud's place publishing doesn't
-- update.
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

local function pathOf(instance: Instance): string
	return instance:GetFullName()
end

local function child(parent: Instance, names: { string }): (Instance?, string?)
	local current = parent
	for _, name in names do
		local found = current:FindFirstChild(name)
		if found == nil then
			return nil, `{pathOf(current)} has no child "{name}"`
		end
		current = found
	end
	return current, nil
end

-- Mirrors TS.getModule in RuntimeLib: search each ancestor's node_modules.
local function getModule(context: Instance, scope: string, name: string): Instance?
	local object: Instance? = context
	while object ~= nil do
		local nodeModules = object:FindFirstChild("node_modules")
		if nodeModules ~= nil then
			local scopeFolder = nodeModules:FindFirstChild(scope)
			local module = if scopeFolder ~= nil then scopeFolder:FindFirstChild(name) else nil
			if module ~= nil then
				return module
			end
		end
		object = object.Parent
	end
	return nil
end

local function quoted(list: string): { string }
	local names = {}
	for name in string.gmatch(list, '"([^"]+)"') do
		table.insert(names, name)
	end
	return names
end

local function dotted(list: string): { string }
	local names = {}
	for name in string.gmatch(list, "[^%.]+") do
		table.insert(names, name)
	end
	return names
end

local SERVER_ONLY = { ServerScriptService = true, ServerStorage = true }

local function serviceOf(instance: Instance): string
	local current = instance
	while current.Parent ~= nil and current.Parent ~= game do
		current = current.Parent :: Instance
	end
	return current.Name
end

-- A client can't see ServerScriptService or ServerStorage, so a script that runs
-- there (or a module it can require) must not import from them.
local function crossesToServer(script: Instance, target: Instance): boolean
	return not SERVER_ONLY[serviceOf(script)] and SERVER_ONLY[serviceOf(target)] == true
end

local problems: { string } = {}
local checked = 0

for _, script in game:GetDescendants() do
	if not script:IsA("LuaSourceContainer") then
		continue
	end
	local source: string = (script :: any).Source
	local function report(message: string)
		table.insert(problems, `{pathOf(script)}: {message}`)
	end

	-- TS.import(script, game:GetService("ReplicatedStorage"), "shared", "features", ...)
	for service, rest in string.gmatch(source, 'TS%.import%(script, game:GetService%("(%w+)"%)([^%)]*)%)') do
		checked += 1
		local root = game:FindFirstChildOfClass(service :: any) or game:FindFirstChild(service)
		if root == nil then
			report(`imports from missing service {service}`)
			continue
		end
		local target, problem = child(root, quoted(rest))
		if problem ~= nil then
			report(`import doesn't resolve: {problem}`)
		elseif target ~= nil and crossesToServer(script, target) then
			report(`imports server-only {pathOf(target)}, which clients can't see`)
		end
	end

	-- TS.getModule(script, "@rbxts", "react").path.inside
	for scope, name, rest in string.gmatch(source, 'TS%.getModule%(script, "([^"]+)", "([^"]+)"%)([%w_%.]*)') do
		checked += 1
		local module = getModule(script, scope, name)
		if module == nil then
			report(`package {scope}/{name} isn't in any node_modules above it; mount its scope in default.rogen.json`)
			continue
		end
		local _, problem = child(module, dotted(rest))
		if problem ~= nil then
			report(`package import doesn't resolve: {problem}`)
		end
	end

	-- require(script.Parent.Parent:WaitForChild("@rbxts-js").React), as packages written in Luau do
	-- Packages built for both layouts probe for one name and fall back to the other, as in
	-- `if script.Parent.Parent:FindFirstChild("react") then ... else require(script.Parent.Parent.React)`.
	-- A require of a probed name in another case is that fallback, not a missing module.
	local probed: { [string]: string } = {}
	for name in string.gmatch(source, 'FindFirstChild%("([^"]+)"%)') do
		probed[string.lower(name)] = name
	end
	local function isLayoutFallback(name: string): boolean
		local other = probed[string.lower(name)]
		return other ~= nil and other ~= name
	end
	for line in string.gmatch(source, "[^\n]+") do
		if string.match(line, "^%s*%-%-") then
			continue
		end
		for start, chain in string.gmatch(line, "()require%(script([%.%[:][^%)]*%)?)") do
			-- `option and require(...)` runs only when the option is on; packages ship without those modules.
			if string.match(string.sub(line, 1, start - 1), "%f[%w]and%s*$") then
				continue
			end
			checked += 1
			local current: Instance? = script
			local position = 1
			while current ~= nil and position <= #chain do
				local step, nextPosition = string.match(chain, "^%.([%a_][%w_]*)()", position)
				if step == nil then
					step, nextPosition = string.match(chain, '^%["([^"]+)"%]()', position)
				end
				if step == nil then
					step, nextPosition = string.match(chain, '^:WaitForChild%("([^"]+)"%)()', position)
				end
				if step == nil then
					step, nextPosition = string.match(chain, '^:FindFirstChild%("([^"]+)"%)()', position)
				end
				if step == nil or nextPosition == nil then
					break
				end
				position = nextPosition :: any
				local from: Instance = current
				current = if step == "Parent" then from.Parent else from:FindFirstChild(step)
				if current == nil and not isLayoutFallback(step) then
					report(`require doesn't resolve: {pathOf(from)} has no {if step == "Parent" then "parent" else `child "{step}"`}`)
				end
			end
		end
	end

	-- require(game:GetService("ReplicatedStorage"):WaitForChild("rbxts_include"):WaitForChild("RuntimeLib"))
	for service, rest in string.gmatch(source, 'require%(game:GetService%("(%w+)"%)((:WaitForChild%("[^"]+"%))+)%)') do
		checked += 1
		local root = game:FindFirstChildOfClass(service :: any) or game:FindFirstChild(service)
		local _, problem = if root ~= nil then child(root, quoted(rest)) else nil, `missing service {service}`
		if problem ~= nil then
			report(`require doesn't resolve: {problem}`)
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
		print(problem)
	end
	print(`\n{#problems} of {checked} imports don't resolve in {placePath}`)
end
if #problems > 0 then
	process.exit(1)
end

print(`ok: all {checked} imports resolve in {placePath}`)
