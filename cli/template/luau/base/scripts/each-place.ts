// Runs steps in each place of the game: the root, for a single-place game, or each projects/<place>/
// for a multi-place one, where a place is a folder of projects/ with a <place>.rogen.json at the root
// (projects/common, the shared code, has none). The mise tasks run their per-place steps through it,
// so they work the same on Windows, macOS and Linux: no shell runs the steps.
//
//   node scripts/each-place.ts "<step>" ["<step>"...] [-- <extra args for the last step>]
//   node scripts/each-place.ts --one <place> "<step>"...   only that place; a multi-place game needs it
//   node scripts/each-place.ts --if-multi "<step>"...      once, at the root, in a multi-place game only
//   node scripts/each-place.ts --parallel "<step>"...      the places at the same time; each place's output is
//                                                          held and printed whole, in the places' order
//
// A step is a command and its arguments, split at spaces; "double quotes" keep spaces in one argument.
// Each runs only if the one before it passed. In a step, {root} is the repo root, {dir} the place's
// folder and {place} its name. `mkdir <folder>` makes a folder and the folders above it. The steps
// also get ROOT and PLACE as environment variables.
import fs from "node:fs";
import path from "node:path";
import spawn from "cross-spawn";

const ROOT = path.resolve(import.meta.dirname, "..");
const multi = fs.existsSync(path.join(ROOT, "projects"));
const places = multi
	? fs
			.readdirSync(path.join(ROOT, "projects"))
			.filter(
				(name) =>
					fs.statSync(path.join(ROOT, "projects", name)).isDirectory() &&
					fs.existsSync(path.join(ROOT, `${name}.rogen.json`)),
			)
			.sort()
	: [];

let args = process.argv.slice(2);
let only: string | undefined;
let ifMulti = false;
let parallel = false;
if (args[0] === "--parallel") {
	parallel = true;
	args = args.slice(1);
}
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
	console.error('Usage: node scripts/each-place.ts [--one <place> | --if-multi | --parallel] "<step>"... [-- <args>]');
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
}
const root: Target = { dir: ROOT, place: path.basename(ROOT) };
const placeTarget = (place: string): Target => ({ dir: path.join(ROOT, "projects", place), place });
const perPlace = multi && !ifMulti;
const targets = perPlace ? places.filter((place) => only === undefined || place === only).map(placeTarget) : [root];

/** Runs the steps in one place, writing what they print through `write`; the code to exit with, or 0. */
async function runTarget(target: Target, write: (text: string) => void, inherit: boolean): Promise<number> {
	const placeholders: Record<string, string> = { root: ROOT, ...target };
	if (perPlace) write(`── ${target.place}\n`);
	for (const [index, step] of steps.entries()) {
		const [command, ...stepArgs] = words(step).map((word) =>
			word.replaceAll(/\{(root|dir|place)\}/g, (_, name: string) => placeholders[name] ?? ""),
		);
		if (command === undefined) continue;
		if (index === steps.length - 1) stepArgs.push(...extra);
		if (command === "mkdir") {
			for (const folder of stepArgs) fs.mkdirSync(path.resolve(target.dir, folder), { recursive: true });
			continue;
		}
		const code = await new Promise<number>((resolve) => {
			const child = spawn(command, stepArgs, {
				cwd: target.dir,
				stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
				env: { ...process.env, ROOT, PLACE: target.place },
			});
			child.stdout?.on("data", (chunk: Buffer) => write(chunk.toString("utf8")));
			child.stderr?.on("data", (chunk: Buffer) => write(chunk.toString("utf8")));
			child.on("error", (error) => {
				write(`${command}: ${error.message}\n`);
				resolve(1);
			});
			child.on("close", (status) => resolve(status ?? 1));
		});
		if (code !== 0) return code;
	}
	return 0;
}

if (parallel && targets.length > 1) {
	const outputs = await Promise.all(
		targets.map(async (target) => {
			let text = "";
			const code = await runTarget(target, (chunk) => (text += chunk), false);
			return { code, text };
		}),
	);
	for (const { text } of outputs) process.stdout.write(text);
	const failed = outputs.find(({ code }) => code !== 0);
	if (failed !== undefined) process.exit(failed.code);
} else {
	for (const target of targets) {
		const code = await runTarget(target, (text) => process.stdout.write(text), true);
		if (code !== 0) process.exit(code);
	}
}
