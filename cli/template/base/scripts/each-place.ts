// Runs a shell command in each place of the game: the root, for a single-place game, or each
// projects/<place>/ (except projects/common) for a multi-place one. The mise tasks run their
// per-place steps through it. Extra arguments are appended to the command. In the command, $ROOT
// is the repo root, $PLACE the place's name and $TSCONFIG the tsconfig that compiles it (the root's
// tsconfig.json, or tsconfig.<place>.json: Sloptor writes only inside its tsconfig's folder).
//
//   node scripts/each-place.ts "<command>" [args...]
//   node scripts/each-place.ts --one <place> "<command>"   only that place; a multi-place game needs it
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const multi = fs.existsSync(path.join(ROOT, "projects"));
const places = multi
	? fs
			.readdirSync(path.join(ROOT, "projects"))
			.filter((name) => fs.existsSync(path.join(ROOT, "projects", name, "default.rogen.json")))
			.sort()
	: [];

let args = process.argv.slice(2);
let only: string | undefined;
if (args[0] === "--one") {
	only = args[1] === "" ? undefined : args[1];
	args = args.slice(2);
	if (multi && only === undefined) {
		console.error(`Name the place: ${places.join(", ")}. For example: mise run dev ${places[0] ?? "<place>"}`);
		process.exit(1);
	}
	if (multi && only !== undefined && !places.includes(only)) {
		console.error(`No place "${only}". The places are: ${places.join(", ")}.`);
		process.exit(1);
	}
}
const [command, ...extra] = args;
if (command === undefined) {
	console.error('Usage: node scripts/each-place.ts [--one <place>] "<command>" [args...]');
	process.exit(1);
}
const quote = (arg: string) => `'${arg.replaceAll("'", "'\\''")}'`;
const line = [command, ...extra.map(quote)].join(" ");

const targets = multi ? places.filter((place) => only === undefined || place === only) : ["."];
for (const place of targets) {
	const cwd = path.join(ROOT, multi ? path.join("projects", place) : "");
	if (multi) console.log(`── ${place}`);
	const run = spawnSync(line, {
		cwd,
		shell: true,
		stdio: "inherit",
		env: {
			...process.env,
			ROOT,
			PLACE: multi ? place : path.basename(ROOT),
			TSCONFIG: path.join(ROOT, multi ? `tsconfig.${place}.json` : "tsconfig.json"),
		},
	});
	if (run.status !== 0) process.exit(run.status ?? 1);
}
