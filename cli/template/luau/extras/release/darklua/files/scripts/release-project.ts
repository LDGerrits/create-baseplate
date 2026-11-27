import fs from "node:fs";
import path from "node:path";
import { mapPaths, pathsIn } from "./rojo-project.ts";

const ROOT = path.resolve(process.env.ROOT ?? process.cwd());
const PROCESSED = /^(src|projects\/[^/]+\/src|Packages|ServerPackages)(\/|$)/;
const toDist = (mount: string) => {
	const fromRoot = path.relative(ROOT, path.resolve(mount)).split(path.sep).join("/");
	if (!PROCESSED.test(fromRoot)) return mount;
	return path.relative(process.cwd(), path.join(ROOT, "dist", fromRoot)).split(path.sep).join("/");
};

const game = JSON.parse(fs.readFileSync("game.project.json", "utf8"));
const release = mapPaths(game, toDist);
const before = pathsIn(game);
if (pathsIn(release).every((mount, i) => mount === before[i])) {
	console.error("release-project: game.project.json mounts nothing from src/, so the release would hold no code");
	process.exit(1);
}
fs.writeFileSync("release.project.json", `${JSON.stringify(release, undefined, "\t")}\n`);
