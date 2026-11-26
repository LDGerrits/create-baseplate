// Writes game.project.json, the whole game: the code from default.project.json (which Rogen writes)
// plus every service in world/default.project.json. Builds, the place check and the tests use it;
// Rojo serves default.project.json alone, so syncing never touches the world.
//
// Also writes test.project.json, the same game with loadstring() on, for jest-roblox: Jest needs
// it, and a live game shouldn't have it, so only the place the engine tests upload gets it.
//
// And sourcemap.json, every instance in the game, from which luau-lsp types the code.
//
// In a multi-place game this runs in projects/<place>/, and the place's code is <place>.project.json
// at the repo root, which Rogen writes from <place>.rogen.json.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Writes `text` to `file` only when it differs, so watchers (the ESLint server, luau-lsp) see no change. */
const write = (file: string, text: string) => {
	if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text) fs.writeFileSync(file, text);
};

type ProjectNode = Record<string, unknown>;

/** The project with every `$path` and `globIgnorePaths` entry passed through `move`. */
const movePaths = (node: unknown, move: (p: string) => string): unknown => {
	if (Array.isArray(node) || node === null || typeof node !== "object") return node;
	return Object.fromEntries(
		Object.entries(node).map(([key, value]) => {
			if (key === "globIgnorePaths" && Array.isArray(value)) return [key, value.map((glob: string) => move(glob))];
			if (key !== "$path") return [key, movePaths(value, move)];
			return [
				key,
				typeof value === "string"
					? move(value)
					: { ...(value as ProjectNode), optional: move((value as { optional: string }).optional) },
			];
		}),
	);
};

const placesDir = path.dirname(process.cwd());
const multi = path.basename(placesDir) === "projects";
const place = path.basename(process.cwd());
const root = path.dirname(placesDir);

// The place's code project sits at the root, so its paths are from there; make them from here.
const code = multi
	? (movePaths(
			JSON.parse(fs.readFileSync(path.join(root, `${place}.project.json`), "utf8")),
			(p) => path.posix.relative(path.posix.join("projects", place), p) || ".",
		) as ProjectNode)
	: JSON.parse(fs.readFileSync("default.project.json", "utf8"));
const world = JSON.parse(fs.readFileSync("world/default.project.json", "utf8"));

// Every world `$path` is from world/, one folder down from game.project.json.
const tree: ProjectNode = { ...(code.tree as ProjectNode) };
for (const [service, node] of Object.entries(world.tree as Record<string, ProjectNode>)) {
	if (service.startsWith("$")) continue;
	if (service in tree) {
		console.error(`game-project: ${service} is in both the code's project file and world/; keep each service in one`);
		process.exit(1);
	}
	tree[service] = movePaths(node, (p) => path.posix.join("world", p)) as ProjectNode;
}

const game = { ...code, name: "game", tree };
write("game.project.json", `${JSON.stringify(game, undefined, "\t")}\n`);

const serverScripts = (tree.ServerScriptService ?? { $className: "ServerScriptService" }) as ProjectNode;
const test = {
	...game,
	name: "test",
	tree: {
		...tree,
		ServerScriptService: {
			...serverScripts,
			$properties: { ...(serverScripts.$properties as ProjectNode | undefined), LoadStringEnabled: true },
		},
	},
};
write("test.project.json", `${JSON.stringify(test, undefined, "\t")}\n`);

// jest-roblox matches its folders against the project's $path strings as written, which here start
// with ../, so a place of a multi-place game also gets a copy at the repo root with paths from
// there: test.<place>.project.json.
if (multi) {
	write(
		path.join(root, `test.${place}.project.json`),
		`${JSON.stringify(
			movePaths(test, (p) => path.posix.normalize(path.posix.join("projects", place, p))),
			undefined,
			"\t",
		)}\n`,
	);
}

// sourcemap.json, every instance of the place, which luau-lsp types the code from.
const sourcemap = spawnSync("rojo", ["sourcemap", "game.project.json", "--include-non-scripts"], {
	encoding: "utf8",
	shell: process.platform === "win32",
	maxBuffer: 256 * 1024 * 1024,
});
if (sourcemap.status !== 0) {
	console.error(`rojo sourcemap: ${sourcemap.error?.message ?? sourcemap.stderr.trim()}`);
	process.exit(1);
}
write("sourcemap.json", sourcemap.stdout);
