// Runs the tests offline in ree, the Roblox engine emulator: the Jest specs, then every end-to-end
// harness in tests/e2e. Run it through `mise run test`, which compiles first. It runs the game of
// game.project.json, or of the project file given: `node scripts/test.ts <project.json>`. Arguments
// after `--` pick what runs (scripts/test-filter.ts): `mise run test -- shop`, `mise run test -- -t "adds"`.
// A run fails on a non-zero exit, on any script error (ree counts errors from scripts other than the
// harness without failing the run), on reaching an engine member ree doesn't emulate, and, for an
// end-to-end test, when it never prints "@done".
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { e2eSelected, parseTestArgs } from "./test-filter.ts";

interface Run {
	name: string;
	harness: string;
	args: string[];
	needsDone?: boolean;
}

interface ReeLine {
	message: string;
	kind: string;
	side?: string;
	trace?: string;
}

interface ReeSummary {
	status: string;
	failure?: string;
	errors: number;
	output?: ReeLine[];
	unemulated?: { member: string; first: string | null }[];
}

// Whether the game holds any spec ree runs: a compiled *.spec.luau in a folder its project mounts.
// A place of a multi-place game may hold none (shared specs run in one place), and then the Jest
// run is skipped rather than started for nothing.
const mounts: string[] = [];
const collectMounts = (node: unknown) => {
	if (typeof node !== "object" || node === null) return;
	for (const [key, value] of Object.entries(node)) {
		if (key !== "$path") collectMounts(value);
		else mounts.push(typeof value === "string" ? value : (value as { optional: string }).optional);
	}
};
const filter = parseTestArgs(process.argv.slice(2));
const project = filter.project ?? "game.project.json";
collectMounts(JSON.parse(fs.readFileSync(project, "utf8")));
// Only the game's code: packages in node_modules carry specs of their own.
const hasSpecs = mounts.some(
	(mount) =>
		!/(^|\/)node_modules(\/|$)/.test(mount) &&
		fs.existsSync(mount) &&
		fs.statSync(mount).isDirectory() &&
		fs
			.readdirSync(mount, { recursive: true, encoding: "utf8" })
			.some((file) => file.endsWith(".spec.luau") && !file.endsWith(".engine.spec.luau")),
);

const runs: Run[] = [
	...(hasSpecs
		? [
				{
					name: "jest",
					harness: path.join(import.meta.dirname, "test/jest.luau"),
					args: ["--run-context", "server", "--seconds", "60", "--context", JSON.stringify(filter)],
				},
			]
		: []),
	...(fs.existsSync("tests/e2e") ? fs.readdirSync("tests/e2e") : [])
		.filter((file) => file.endsWith(".luau") && e2eSelected(`tests/e2e/${file}`, filter))
		.sort()
		.map((file) => ({
			name: `e2e/${path.basename(file, ".luau")}`,
			harness: path.join("tests/e2e", file),
			args: ["--run-context", "loopback", "--mode", "play", "--player", "Tester", "--seconds", "30"],
			needsDone: true,
		})),
];

// Traces name the game's instances (`ServerScriptService.features.shop.shop-service.spec:17`), at
// lines of the compiled Luau. Each such frame gets the TypeScript file and line it came from, through
// the project file (instance to compiled file) and the compiler's source map beside that file.
const compiledFiles = new Map<string, string>();
const indexTree = (node: unknown, names: string[]) => {
	if (typeof node !== "object" || node === null) return;
	for (const [key, value] of Object.entries(node)) {
		if (key === "$path") {
			const mount = typeof value === "string" ? value : (value as { optional: string }).optional;
			if (!/(^|\/)node_modules(\/|$)/.test(mount)) indexMount(mount, names);
		} else if (!key.startsWith("$")) indexTree(value, [...names, key]);
	}
};
const indexMount = (mount: string, names: string[]) => {
	if (!fs.existsSync(mount)) return;
	if (fs.statSync(mount).isFile()) {
		if (mount.endsWith(".luau")) compiledFiles.set(names.join("."), mount);
		return;
	}
	for (const file of fs.readdirSync(mount, { recursive: true, encoding: "utf8" })) {
		if (!file.endsWith(".luau")) continue;
		const parts = file.split(path.sep);
		const name = (parts.pop() ?? "").replace(/(\.server|\.client)?\.luau$/, "");
		compiledFiles.set([...names, ...parts, ...(name === "init" ? [] : [name])].join("."), path.join(mount, file));
	}
};
indexTree(JSON.parse(fs.readFileSync(project, "utf8")).tree, []);

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** The source file and 1-based line a compiled line comes from, through `<file>.map`. */
function sourceOf(compiled: string, line: number): string | undefined {
	let map: { sources: string[]; mappings: string };
	try {
		map = JSON.parse(fs.readFileSync(`${compiled}.map`, "utf8"));
	} catch {
		return undefined;
	}
	// Source maps' fields are base64 VLQ deltas; the source and its line carry across lines.
	let source = 0;
	let sourceLine = 0;
	const lines = map.mappings.split(";");
	for (let index = 0; index < lines.length && index < line; index++) {
		for (const segment of (lines[index] ?? "").split(",")) {
			const fields: number[] = [];
			let value = 0;
			let shift = 0;
			for (const char of segment) {
				const digit = BASE64.indexOf(char);
				value += (digit & 31) << shift;
				if (digit & 32) shift += 5;
				else {
					fields.push(value & 1 ? -(value >> 1) : value >> 1);
					value = 0;
					shift = 0;
				}
			}
			if (fields.length < 4) continue;
			source += fields[1] ?? 0;
			sourceLine += fields[2] ?? 0;
			if (index === line - 1) {
				const file = path.resolve(path.dirname(compiled), map.sources[source] ?? "");
				return `${path.relative(process.env.ROOT ?? process.cwd(), file)}:${sourceLine + 1}`;
			}
		}
	}
	return undefined;
}

/** Adds the TypeScript location after each frame in the game's own code. */
const withSources = (text: string) =>
	text.replace(/[\w@-]+(?:\.[\w@-]+)+:(\d+)/g, (frame, line: string) => {
		const compiled = compiledFiles.get(frame.slice(0, frame.lastIndexOf(":")));
		const source = compiled && sourceOf(compiled, Number(line));
		return source ? `${frame} → ${source}` : frame;
	});

let failed = 0;
for (const run of runs) {
	const started = performance.now();
	const ree = spawnSync("ree", ["run", "--rojo", project, "--load-string", "--harness", run.harness, ...run.args], {
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
	const seconds = ((performance.now() - started) / 1000).toFixed(2);

	let summary: ReeSummary;
	try {
		summary = JSON.parse(ree.stdout);
	} catch {
		failed++;
		console.log(`✗ ${run.name}: ree printed no summary (exit ${ree.status})\n${ree.stderr.trim()}`);
		continue;
	}

	const output = summary.output ?? [];
	const done = output.some((line) => line.message === "@done");
	const problems = [
		ree.status !== 0 && `ree exited ${ree.status}`,
		summary.status === "error" && (summary.failure ?? "the harness failed"),
		summary.errors > 0 && `${summary.errors} script error(s)`,
		(summary.unemulated ?? []).length > 0 &&
			`reached what ree doesn't emulate (${(summary.unemulated ?? []).map((u) => (u.first === null ? u.member : `${u.member} at ${u.first}`)).join(", ")}); test that in a *.engine.spec`,
		run.needsDone && !done && summary.status !== "error" && 'the test never printed "@done"',
	].filter(Boolean);

	const jestLine = output.find((line) => line.message.startsWith("@jest "));
	const detail = jestLine ? jestLine.message.slice("@jest ".length) : "passed";
	if (problems.length === 0) {
		console.log(`✓ ${run.name}: ${detail} (${seconds}s)`);
		continue;
	}

	failed++;
	console.log(`✗ ${run.name}: ${problems.join("; ")}`);
	for (const line of output) {
		if (line.message === "@done" || line.message.startsWith("@jest ")) continue;
		const side = line.side ? `[${line.side}] ` : "";
		const kind = line.kind === "print" ? "" : `${line.kind}: `;
		console.log(`  ${side}${kind}${withSources(line.message).replaceAll("\n", "\n  ")}`);
		if (line.trace) console.log(`    ${withSources(line.trace.trim()).replaceAll("\n", "\n    ")}`);
	}
}

process.exit(failed > 0 ? 1 : 0);
