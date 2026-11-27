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
		console.error(
			`Name the place: ${places.join(", ")}. For example: mise run ${process.env.MISE_TASK_NAME ?? "dev"} ${places[0] ?? "<place>"}`,
		);
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

const words = (step: string) => [...step.matchAll(/"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2] ?? "");

interface Target {
	dir: string;
	place: string;
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

// A signal sent to this process alone, as `timeout` or an agent stopping a background task sends,
// goes on to the running steps, so a long-running one such as `forge start` shuts down itself
// rather than being left running. Ctrl+C reaches them already, through the terminal.
const running = new Set<ReturnType<typeof spawn>>();
for (const signal of ["SIGTERM", "SIGHUP"] as const) {
	process.on(signal, () => {
		for (const child of running) child.kill(signal);
		if (running.size === 0) process.exit(1);
	});
}

async function runTarget(target: Target, write: (text: string) => void, inherit: boolean): Promise<number> {
	const placeholders: Record<string, string> = { root: ROOT, ...target };
	if (perPlace) write(`── ${target.place}\n`);
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
		const code = await new Promise<number>((resolve) => {
			const child = spawn(command, stepArgs, {
				cwd: target.dir,
				stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
				env: { ...process.env, ROOT, PLACE: target.place, TSCONFIG: target.tsconfig },
			});
			child.stdout?.on("data", (chunk: Buffer) => write(chunk.toString("utf8")));
			child.stderr?.on("data", (chunk: Buffer) => write(chunk.toString("utf8")));
			child.on("error", (error) => {
				write(`${command}: ${error.message}\n`);
				resolve(1);
			});
			running.add(child);
			child.on("close", (status) => {
				running.delete(child);
				resolve(status ?? 1);
			});
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
