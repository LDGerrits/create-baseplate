import fs from "node:fs";
import { mapPaths, pathsIn } from "./rojo-project.ts";

const toDist = (mount: string) => mount.replace(/^((?:\.\.\/)*)out(?=\/|$)/, "$1dist");

const game = JSON.parse(fs.readFileSync("game.project.json", "utf8"));
const release = mapPaths(game, toDist);
const before = pathsIn(game);
if (pathsIn(release).every((mount, i) => mount === before[i])) {
	console.error("release-project: game.project.json mounts nothing from out/, so the release would hold no code");
	process.exit(1);
}
fs.writeFileSync("release.project.json", `${JSON.stringify(release, undefined, "\t")}\n`);
