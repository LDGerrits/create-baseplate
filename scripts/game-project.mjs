// Writes game.project.json, the whole game: the code from default.project.json (which Rogen writes)
// plus every service in world/default.project.json. Builds, the place check and the tests use it;
// Rojo serves default.project.json alone, so syncing never touches the world.
import fs from "node:fs";
import path from "node:path";

const code = JSON.parse(fs.readFileSync("default.project.json", "utf8"));
const world = JSON.parse(fs.readFileSync("world/default.project.json", "utf8"));

// Re-root every `$path` in a world node, since game.project.json sits one folder up.
const reroot = (node) =>
	Object.fromEntries(
		Object.entries(node).map(([key, value]) => {
			if (key === "$path") {
				return typeof value === "string"
					? [key, path.posix.join("world", value)]
					: [key, { ...value, optional: path.posix.join("world", value.optional) }];
			}
			return [key, value !== null && typeof value === "object" && !key.startsWith("$") ? reroot(value) : value];
		}),
	);

const tree = { ...code.tree };
for (const [service, node] of Object.entries(world.tree)) {
	if (service.startsWith("$")) continue;
	if (service in tree) {
		console.error(`game-project: ${service} is in both default.project.json and world/; keep each service in one`);
		process.exit(1);
	}
	tree[service] = reroot(node);
}

const game = { ...code, name: "game", tree };
fs.writeFileSync("game.project.json", `${JSON.stringify(game, undefined, "\t")}\n`);
