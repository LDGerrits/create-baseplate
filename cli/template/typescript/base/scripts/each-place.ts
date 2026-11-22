// Runs steps in each place of the game: the root, for a single-place game, or each projects/<place>/
// (except projects/common) for a multi-place one. The mise tasks run their per-place steps through
// it, so they work the same on Windows, macOS and Linux: no shell runs the steps.
//
//   node scripts/each-place.ts "<step>" ["<step>"...] [-- <extra args for the last step>]
//   node scripts/each-place.ts --one <place> "<step>"...   only that place; a multi-place game needs it
//   node scripts/each-place.ts --if-multi "<step>"...      once, at the root, in a multi-place game only
//
// A step is a command and its arguments, split at spaces; "double quotes" keep spaces in one argument.
// Each runs only if the one before it passed. In a step, {root} is the repo root, {dir} the place's
// folder, {place} its name and {tsconfig} the tsconfig that compiles it (the root's tsconfig.json,
// or tsconfig.<place>.json: Sloptor writes only inside its tsconfig's folder). `mkdir <folder>` makes
// a folder and the folders above it. The steps also get ROOT, PLACE and TSCONFIG as environment
// variables.
import fs from "node:fs";
import path from "node:path";
import spawn from "cross-spawn";

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
let ifMulti = false;
if (args[0] === "--if-multi") {
	ifMulti = true;
	args = args.slice(1);
}
if (args[0] === "--one") {
	only = args[1] === "" ? undefined : args[1];
	args = args.slice(2);
	if (multi && only === undefined) {
		console.error(`Name the place: ${places.join(", ")}. For example: mise run dev ${places[0] ?? "<place>"}`);
		process.exit(1);
	}
	if (!multi && only !== undefined) {
		console.error(`This game has one place: run it without a name.`);
		process.exit(1);
	}
	if (multi && only !== undefined && !places.includes(only)) {
		console.error(`No place "${only}". The places are: ${places.join(", ")}.`);
		process.exit(1);
	}
}
const dash = args.indexOf("--");
const steps = dash === -1 ? args : args.slice(0, dash);
const extra = dash === -1 ? [] : args.slice(dash + 1);
if (steps.length === 0) {
	console.error('Usage: node scripts/each-place.ts [--one <place> | --if-multi] "<step>"... [-- <args>]');
	process.exit(1);
}
if (ifMulti && !multi) process.exit(0);

/** A step's words: split at spaces, with "double quotes" holding one word together. */
const words = (step: string) => [...step.matchAll(/"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2] ?? "");

/** Where steps run: a place, or the repo root, which is the place in a single-place game. */
interface Target {
	/** The folder the steps run in. */
	dir: string;
	/** The place's name; the game's, for the root. */
	place: string;
	/** The tsconfig that compiles it. */
	tsconfig: string;
}
const root: Target = { dir: ROOT, place: path.basename(ROOT), tsconfig: path.join(ROOT, "tsconfig.json") };
const placeTarget = (place: string): Target => ({
	dir: path.join(ROOT, "projects", place),
	place,
	tsconfig: path.join(ROOT, `tsconfig.${place}.json`),
});
const perPlace = multi && !ifMulti;
const targets = perPlace ? places.filter((place) => only === undefined || place === only).map(placeTarget) : [root];

for (const target of targets) {
	const placeholders: Record<string, string> = { root: ROOT, ...target };
	if (perPlace) console.log(`── ${target.place}`);
	for (const [index, step] of steps.entries()) {
		const [command, ...stepArgs] = words(step).map((word) =>
			word.replaceAll(/\{(root|dir|place|tsconfig)\}/g, (_, name: string) => placeholders[name] ?? ""),
		);
		if (command === undefined) continue;
		if (index === steps.length - 1) stepArgs.push(...extra);
		if (command === "mkdir") {
			for (const folder of stepArgs) fs.mkdirSync(path.resolve(target.dir, folder), { recursive: true });
			continue;
		}
		const run = spawn.sync(command, stepArgs, {
			cwd: target.dir,
			stdio: "inherit",
			env: { ...process.env, ROOT, PLACE: target.place, TSCONFIG: target.tsconfig },
		});
		if (run.error) {
			console.error(`${command}: ${run.error.message}`);
			process.exit(1);
		}
		if (run.status !== 0) process.exit(run.status ?? 1);
	}
}
