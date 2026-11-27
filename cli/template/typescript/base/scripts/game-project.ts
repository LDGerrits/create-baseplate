// Also writes test.project.json, the same game with loadstring() on, for jest-roblox: Jest needs
// it, and a live game shouldn't have it, so only the place the engine tests upload gets it.
import fs from "node:fs";
import path from "node:path";
import { mapPaths, type ProjectNode, testProjectOf, writeIfChanged } from "./rojo-project.ts";

const code = JSON.parse(fs.readFileSync("default.project.json", "utf8"));
const world = JSON.parse(fs.readFileSync("world/default.project.json", "utf8"));

const tree: ProjectNode = { ...code.tree };
for (const [service, node] of Object.entries(world.tree as Record<string, ProjectNode>)) {
	if (service.startsWith("$")) continue;
	if (service in tree) {
		console.error(`game-project: ${service} is in both default.project.json and world/; keep each service in one`);
		process.exit(1);
	}
	tree[service] = mapPaths(node, (p) => path.posix.join("world", p));
}

const game = { ...code, name: "game", tree };
writeIfChanged("game.project.json", `${JSON.stringify(game, undefined, "\t")}\n`);

const test = testProjectOf(game);
writeIfChanged("test.project.json", `${JSON.stringify(test, undefined, "\t")}\n`);

// In a multi-place game this runs in projects/<place>/. jest-roblox matches its compiled folders
// against the project's $path strings as written, which here start with ../../, so it also gets a
// copy at the repo root with paths from there: test.<place>.project.json.
const placesDir = path.dirname(process.cwd());
if (path.basename(placesDir) === "projects") {
	const place = path.basename(process.cwd());
	writeIfChanged(
		path.join(placesDir, "..", `test.${place}.project.json`),
		`${JSON.stringify(
			mapPaths(test, (p) => path.posix.normalize(path.posix.join("projects", place, p))),
			undefined,
			"\t",
		)}\n`,
	);
}
