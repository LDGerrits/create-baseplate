// Also writes test.project.json, the same game with loadstring() on, for jest-roblox: Jest needs
// it, and a live game shouldn't have it, so only the place the engine tests upload gets it.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mapPaths, testProjectOf, writeIfChanged } from "./rojo-project.ts";

const placesDir = path.dirname(process.cwd());
const multi = path.basename(placesDir) === "projects";
const place = path.basename(process.cwd());
const root = path.dirname(placesDir);

const code = multi
	? mapPaths(
			JSON.parse(fs.readFileSync(path.join(root, `${place}.project.json`), "utf8")),
			(p) => path.posix.relative(path.posix.join("projects", place), p) || ".",
		)
	: JSON.parse(fs.readFileSync("default.project.json", "utf8"));

const game = { ...code, name: "game" };
writeIfChanged("game.project.json", `${JSON.stringify(game, undefined, "\t")}\n`);

const test = testProjectOf(game);
writeIfChanged("test.project.json", `${JSON.stringify(test, undefined, "\t")}\n`);

// jest-roblox matches its folders against the project's $path strings as written, which here start
// with ../, so a place of a multi-place game also gets a copy at the repo root with paths from
// there: test.<place>.project.json.
if (multi) {
	writeIfChanged(
		path.join(root, `test.${place}.project.json`),
		`${JSON.stringify(
			mapPaths(test, (p) => path.posix.normalize(path.posix.join("projects", place, p))),
			undefined,
			"\t",
		)}\n`,
	);
}

const sourcemap = spawnSync("rojo", ["sourcemap", "game.project.json", "--include-non-scripts"], {
	encoding: "utf8",
	shell: process.platform === "win32",
	maxBuffer: 256 * 1024 * 1024,
});
if (sourcemap.status !== 0) {
	console.error(`rojo sourcemap: ${sourcemap.error?.message ?? sourcemap.stderr.trim()}`);
	process.exit(1);
}
writeIfChanged("sourcemap.json", sourcemap.stdout);
