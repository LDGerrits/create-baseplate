// `mise run feature <name>`: starts a feature the way AGENTS.md's "Adding a feature" describes, so
// its folders, its rate-limited event and its entry-script entries are right from the first line.
//
//   node scripts/feature.ts <name> [<place>]
//
// <name> is lowercase letters and digits, as Roblox paths need it: `shop` makes src/features/shop
// with a network file, a service with a spec and a controller, and lists the service and the
// controller in the entry scripts. In a multi-place game the feature goes in projects/common/src
// and every place lists it; naming a place keeps it to that one place's src. The UI is yours to
// add: a component and its story.
import fs from "node:fs";
import path from "node:path";

const ENTRIES = { server: "app/server/Main.server.luau", client: "app/client/Start.luau" };

const pascal = (name: string) => name.replace(/^./, (letter) => letter.toUpperCase());

/** The files of a feature, by path from its folder. */
export function featureFiles(name: string): Record<string, string> {
	const Name = pascal(name);
	return {
		[`shared/${Name}Network.luau`]: `-- The ${name} feature's remotes. Each declares the arguments it carries: the type for the type checker,
-- and for what clients send, a \`t\` check the server runs before any handler sees the call.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remote = require(ReplicatedStorage.Shared.network.Remote)
local t = require(ReplicatedStorage.Packages.t)

return {
	-- Client to server: the player asks for their value. Carries nothing.
	request = Remote.clientEvent("request", t.tuple()) :: Remote.ClientEvent<()>,
	-- Server to client: the player's value.
	changed = Remote.serverEvent("changed") :: Remote.ServerEvent<number>,
}
`,
		[`server/${Name}Service.luau`]: `-- Owns every player's ${name} state. Clients ask; this service decides.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")

local ${Name}Network = require(ReplicatedStorage.Shared.features.${name}.${Name}Network)
local RateLimit = require(ServerScriptService.network.RateLimit)
local Serve = require(ServerScriptService.network.Serve)

local ${Name}Service = {}

local values: { [number]: number } = {}

function ${Name}Service.getValue(userId: number): number
	return values[userId] or 0
end

-- Main.server.luau calls this once, after every service has loaded.
function ${Name}Service.start()
	-- Every client-to-server event needs a rate limit, or the check fails.
	Serve.event(${Name}Network.request, { limit = RateLimit.perSecond(10) }, function(player)
		${Name}Network.changed:fire(player, ${Name}Service.getValue(player.UserId))
	end)
end

return ${Name}Service
`,
		[`server/${Name}Service.spec.luau`]: `local ReplicatedStorage = game:GetService("ReplicatedStorage")

local JestGlobals = require(ReplicatedStorage.DevPackages.JestGlobals)
local beforeEach = JestGlobals.beforeEach
local describe = JestGlobals.describe
local expect = JestGlobals.expect
local it = JestGlobals.it
local jest = JestGlobals.jest

describe("${Name}Service", function()
	local ${Name}Service

	-- A fresh copy of the service for each test, so state doesn't carry over.
	beforeEach(function()
		jest.resetModules()
		${Name}Service = require(script.Parent.${Name}Service)
	end)

	it("starts a player at zero", function()
		expect(${Name}Service.getValue(1)).toBe(0)
	end)
end)
`,
		[`client/${Name}Controller.luau`]: `-- Asks the server for the ${name} state, and keeps its latest answer for the UI.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ${Name}Network = require(ReplicatedStorage.Shared.features.${name}.${Name}Network)

local ${Name}Controller = {}

local value = 0

-- Start.luau calls this once, after every controller has loaded.
function ${Name}Controller.start()
	${Name}Network.changed:connect(function(newValue)
		value = newValue
	end)
	${Name}Network.request:fire()
end

function ${Name}Controller.getValue(): number
	return value
end

return ${Name}Controller
`,
	};
}

/** Adds `line` after the last line of `source` that matches `list`, a require in the entry script's list. */
export function addEntry(source: string, line: string, list: RegExp): string {
	if (source.includes(line.trim())) return source;
	const lines = source.split("\n");
	const last = lines.findLastIndex((text) => list.test(text));
	if (last === -1) throw new Error(`No list of requires like ${list} to add ${line.trim()} to.`);
	lines.splice(last + 1, 0, line);
	return lines.join("\n");
}

/** Creates the feature under `cwd`, and returns the files it wrote or changed. */
export function createFeature(cwd: string, name: string, place?: string): string[] {
	if (!/^[a-z][a-z0-9]*$/.test(name)) {
		throw new Error(
			`Name the feature in lowercase letters and digits, such as "shop" or "dailyreward": not "${name}".`,
		);
	}
	const Name = pascal(name);
	const at = (...parts: string[]) => path.posix.join(...parts);
	const multi = fs.existsSync(path.join(cwd, "projects"));
	const places = multi
		? fs
				.readdirSync(path.join(cwd, "projects"))
				.filter((dir) => dir !== "common" && fs.existsSync(path.join(cwd, "projects", dir, "src")))
				.sort()
		: [];
	if (!multi && place !== undefined) throw new Error("This game has one place: run it without a place.");
	if (multi && place !== undefined && !places.includes(place)) {
		throw new Error(`No place "${place}". The places are: ${places.join(", ")}.`);
	}

	const featureRoot = at(
		place === undefined ? (multi ? at("projects", "common", "src") : "src") : at("projects", place, "src"),
		"features",
		name,
	);
	if (fs.existsSync(path.join(cwd, featureRoot))) throw new Error(`${featureRoot} already exists.`);

	const written: string[] = [];
	for (const [file, text] of Object.entries(featureFiles(name))) {
		const target = at(featureRoot, file);
		fs.mkdirSync(path.dirname(path.join(cwd, target)), { recursive: true });
		fs.writeFileSync(path.join(cwd, target), text);
		written.push(target);
	}

	const entryRoots = multi ? (place === undefined ? places : [place]).map((p) => at("projects", p, "src")) : ["src"];
	for (const root of entryRoots) {
		const server = at(root, ENTRIES.server);
		fs.writeFileSync(
			path.join(cwd, server),
			addEntry(
				fs.readFileSync(path.join(cwd, server), "utf8"),
				`\trequire(ServerScriptService.features.${name}.${Name}Service),`,
				/^\trequire\(ServerScriptService\.features\..*\),$/,
			),
		);
		written.push(server);
		const client = at(root, ENTRIES.client);
		fs.writeFileSync(
			path.join(cwd, client),
			addEntry(
				fs.readFileSync(path.join(cwd, client), "utf8"),
				`\trequire(features.${name}.${Name}Controller),`,
				/^\trequire\(features\..*\),$/,
			),
		);
		written.push(client);
	}
	return written;
}

if (import.meta.main) {
	const [name, place] = process.argv.slice(2);
	if (name === undefined || name === "") {
		console.error("Usage: mise run feature <name> [<place>]");
		process.exit(1);
	}
	try {
		for (const file of createFeature(process.cwd(), name, place === "" ? undefined : place)) console.log(file);
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
	console.log(
		"\nRun `mise run check`. Next: the feature's rules in the service, its tests, and a component with a story.",
	);
}
