// `mise run feature <name>`: starts a feature the way AGENTS.md's "Adding a feature" describes, so
// its folders, its event and its entry-script imports are right from the first line.
//
//   node scripts/feature.ts <name> [<place>]
//
// <name> is kebab-case: `shop` makes src/features/shop with a network file, a service with a spec
// and a controller, and imports the service and the controller in the entry scripts. In a
// multi-place game the feature goes in projects/common/src and every place imports it; naming a
// place keeps it to that one place's src. The UI is yours to add: a component and its story.
import fs from "node:fs";
import path from "node:path";

const ENTRIES = { server: "app/server/main.server.ts", client: "app/client/main.client.ts" };

const pascal = (name: string) => name.replace(/(^|-)([a-z0-9])/g, (_, __, letter: string) => letter.toUpperCase());

/**
 * The files of a feature, by path from its folder. `rateLimitFrom` is the rate limiter's module, as
 * the service imports it.
 */
export function featureFiles(
	name: string,
	rateLimitFrom = "../../../platform/network/server/rate-limit",
): Record<string, string> {
	const Name = pascal(name);
	return {
		[`shared/${name}-network.ts`]: `import { Networking } from "@flamework/networking";

interface ClientToServer {
	request(): void;
}

interface ServerToClient {
	changed(value: number): void;
}

export const ${Name}Network = Networking.createEvent<ClientToServer, ServerToClient>();
`,
		[`server/${name}-service.ts`]: `import { type OnStart, Service } from "@flamework/core";
import { rateLimit } from "${rateLimitFrom}";
import { ${Name}Network } from "../shared/${name}-network";

const events = ${Name}Network.createServer({ middleware: { request: [rateLimit(0.2)] } });

/** Owns every player's ${name} state. Clients ask; this service decides. */
@Service()
export class ${Name}Service implements OnStart {
	private readonly values = new Map<number, number>();

	onStart() {
		events.request.connect((player) => {
			events.changed.fire(player, this.getValue(player.UserId));
		});
	}

	getValue(userId: number): number {
		return this.values.get(userId) ?? 0;
	}
}
`,
		[`server/${name}-service.spec.ts`]: `import { beforeEach, describe, expect, it } from "@rbxts/jest-globals";
import { ${Name}Service } from "./${name}-service";

describe("${Name}Service", () => {
	let service: ${Name}Service;

	beforeEach(() => {
		service = new ${Name}Service();
	});

	it("starts a player at zero", () => {
		expect(service.getValue(1)).toBe(0);
	});
});
`,
		[`client/${name}-controller.ts`]: `import { Controller, type OnStart } from "@flamework/core";
import { ${Name}Network } from "../shared/${name}-network";

const events = ${Name}Network.createClient({});

/** Asks the server for the ${name} state, and keeps its latest answer for the UI. */
@Controller()
export class ${Name}Controller implements OnStart {
	private value = 0;

	onStart() {
		events.changed.connect((value) => {
			this.value = value;
		});
		events.request.fire();
	}

	getValue() {
		return this.value;
	}
}
`,
	};
}

/** Adds an `import "<specifier>";` after the entry script's last side-effect import of a feature, or before Flamework.ignite(). */
export function addImport(source: string, specifier: string): string {
	const line = `import "${specifier}";`;
	if (source.includes(line)) return source;
	const lines = source.split("\n");
	const last = lines.findLastIndex((text) => /^import "\.\.?\/[^"]*";$/.test(text));
	if (last !== -1) {
		lines.splice(last + 1, 0, line);
		return lines.join("\n");
	}
	const ignite = lines.findIndex((text) => text.startsWith("Flamework.ignite()"));
	if (ignite === -1) throw new Error("No `Flamework.ignite()` to start the feature before.");
	lines.splice(ignite, 0, line, "");
	return lines.join("\n");
}

/** The feature's end-to-end test: a client asks for its value through the real server and remotes. */
export function e2eFile(name: string): string {
	const Name = pascal(name);
	return `-- End-to-end: the ${name} feature's requests through the real server and remotes, the way a
-- player's client sends them. Test each request a client sends here; \`scripts/test.ts\` runs every
-- file in this folder.

-- A harness replaces the place's own boot, so start the server's entry script ourselves.
local function bootServer()
	local main = game:GetService("ServerScriptService").app.main
	local run = assert(loadstring(main.Source, "=" .. main:GetFullName()))
	setfenv(run, setmetatable({ script = main }, { __index = getfenv(0) }))
	task.spawn(run)
end

-- Wait for a condition rather than a fixed time: fixed waits make tests slow and flaky.
local function waitFor<T>(what: string, check: () -> T?, seconds: number?): T
	local deadline = os.clock() + (seconds or 5)
	while os.clock() < deadline do
		local value = check()
		if value then
			return value
		end
		task.wait()
	end
	error(\`timed out waiting for {what}\`)
end

-- Flamework creates the feature's remotes as the server starts, in a folder named after its network file.
local NETWORK = "/${name}-network@${Name}Network"

local function remote(name: string): RemoteEvent
	return waitFor(\`the ${name} {name} remote\`, function()
		for _, folder in game:GetService("ReplicatedStorage"):GetChildren() do
			if folder:IsA("Folder") and string.find(folder.Name, NETWORK, 1, true) then
				local found = folder:FindFirstChild(name)
				if found and found:IsA("RemoteEvent") then
					return found
				end
			end
		end
		return nil
	end)
end

return {
	Server = function()
		bootServer()
	end,

	Client = function()
		local values = {}
		remote("changed").OnClientEvent:Connect(function(value)
			table.insert(values, value)
		end)
		remote("request"):FireServer()
		waitFor("the server's answer", function()
			return #values >= 1
		end)
		assert(values[1] == 0, \`expected 0, got {values[1]}\`)
		print("@done")
	end,
}
`;
}

/** Creates the feature under `cwd`, and returns the files it wrote or changed. */
export function createFeature(cwd: string, name: string, place?: string): string[] {
	if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
		throw new Error(`Name the feature in kebab-case, such as "shop" or "daily-reward": not "${name}".`);
	}
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

	const sharedRoot = multi ? at("projects", "common", "src") : "src";
	const featureRoot = at(place === undefined ? sharedRoot : at("projects", place, "src"), "features", name);
	if (fs.existsSync(path.join(cwd, featureRoot))) throw new Error(`${featureRoot} already exists.`);

	const written: string[] = [];
	const limiter = at(sharedRoot, "platform", "network", "server", "rate-limit");
	if (!fs.existsSync(path.join(cwd, `${limiter}.ts`))) {
		throw new Error(
			`The feature's service rate-limits its event with ${limiter}.ts, which this game doesn't have. Restore it, or a newer create-baseplate creates games with it (\`create-baseplate sync\` updates only the agent files).`,
		);
	}
	const rateLimitFrom = path.posix.relative(at(featureRoot, "server"), limiter);
	for (const [file, text] of Object.entries(featureFiles(name, rateLimitFrom))) {
		const target = at(featureRoot, file);
		fs.mkdirSync(path.dirname(path.join(cwd, target)), { recursive: true });
		fs.writeFileSync(path.join(cwd, target), text);
		written.push(target);
	}

	// Its end-to-end test goes where the tests of its code run: in a multi-place game, a shared
	// feature's in the place that runs the shared code's tests.
	const testPlace = place ?? (places.includes("game") ? "game" : places[0]);
	const e2e = at(
		multi && testPlace !== undefined ? at("projects", testPlace, "tests") : "tests",
		"e2e",
		`${name}.luau`,
	);
	if (!fs.existsSync(path.join(cwd, e2e))) {
		fs.mkdirSync(path.dirname(path.join(cwd, e2e)), { recursive: true });
		fs.writeFileSync(path.join(cwd, e2e), e2eFile(name));
		written.push(e2e);
	}

	const entryRoots = multi ? (place === undefined ? places : [place]).map((p) => at("projects", p, "src")) : ["src"];
	for (const root of entryRoots) {
		for (const [side, entry, file] of [
			["server", ENTRIES.server, `${name}-service`],
			["client", ENTRIES.client, `${name}-controller`],
		] as const) {
			const target = at(root, entry);
			const specifier = path.posix.relative(path.posix.dirname(target), at(featureRoot, side, file));
			fs.writeFileSync(path.join(cwd, target), addImport(fs.readFileSync(path.join(cwd, target), "utf8"), specifier));
			written.push(target);
		}
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
