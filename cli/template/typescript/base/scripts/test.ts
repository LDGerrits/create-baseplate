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
// ree loads each end-to-end test, Luau as written, as ReplicatedStorage.RURFixtures.<name>.
const fixtures = new Map(
	runs
		.filter((run) => run.name.startsWith("e2e/"))
		.map((run) => [`ReplicatedStorage.RURFixtures.${run.name.slice(4)}`, run.harness]),
);

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
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

const withSources = (text: string) =>
	text.replace(/[\w@-]+(?:\.[\w@-]+)+:(\d+)/g, (frame, line: string) => {
		const name = frame.slice(0, frame.lastIndexOf(":"));
		const fixture = fixtures.get(name);
		if (fixture) return `${frame} → ${path.relative(process.env.ROOT ?? process.cwd(), path.resolve(fixture))}:${line}`;
		const compiled = compiledFiles.get(name);
		const source = compiled && sourceOf(compiled, Number(line));
		return source ? `${frame} → ${source}` : frame;
	});

const plain = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

const NOT_OURS = /rbxts_include|node_modules|_Index|DevPackages|\brur\.\w+:|RURFixtures\.jest\b/;
const FRAME = /^\s*\S+:\d+(\s|$)/;
const ownLines = (text: string) =>
	text
		.split("\n")
		.filter((line, index) => index === 0 || !(FRAME.test(line) && NOT_OURS.test(line)))
		.join("\n");

const inMultiPlace = fs.existsSync(path.join(process.env.ROOT ?? ".", "projects"));
if (
	runs.length === 0 &&
	!inMultiPlace &&
	filter.testPathPattern === undefined &&
	filter.testNamePattern === undefined
) {
	console.log("No specs or end-to-end tests yet: add a <name>.spec beside the code, or tests/e2e/<feature>.luau.");
	process.exit(0);
}
let failed = 0;
let ran = 0;
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
		console.log(
			ree.error === undefined
				? `✗ ${run.name}: ree printed no summary (exit ${ree.status})\n${ree.stderr.trim()}`
				: `✗ ${run.name}: couldn't start ree (${ree.error.message}); run the tests through mise: \`mise run test\``,
		);
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
	// Tests a name filter leaves out count as skipped in the total, so count what ran.
	const counts = jestLine ? /(\d+) passed, (\d+) failed/.exec(jestLine.message) : null;
	ran += counts ? Number(counts[1]) + Number(counts[2]) : 1;
	if (problems.length === 0) {
		console.log(`✓ ${run.name}: ${detail} (${seconds}s)`);
		continue;
	}

	failed++;
	console.log(`✗ ${run.name}: ${problems.join("; ")}`);
	for (const line of output) {
		if (line.message === "@done" || line.message.startsWith("@jest ") || line.message === "Jest: tests failed")
			continue;
		const side = line.side ? `[${line.side}] ` : "";
		const kind = line.kind === "print" ? "" : `${line.kind}: `;
		console.log(`  ${side}${kind}${withSources(ownLines(plain(line.message))).replaceAll("\n", "\n  ")}`);
		if (line.trace) console.log(`    ${withSources(ownLines(plain(line.trace)).trim()).replaceAll("\n", "\n    ")}`);
	}
	const timedOut =
		output.some((line) => line.kind !== "print" && /timed out/i.test(line.message)) ||
		(summary.errors === 0 && problems.some((problem) => String(problem).includes("@done")));
	if (run.name.startsWith("e2e/") && timedOut) {
		console.log(
			"  If it waits on a touch, physics or a character: ree doesn't emulate them. Test that in an *.engine.spec, run in Roblox by `mise run test:engine`.",
		);
	}
}

const multiPlace = fs.existsSync(path.join(process.env.ROOT ?? ".", "projects"));
const filtered = filter.testPathPattern !== undefined || filter.testNamePattern !== undefined;
if (failed === 0 && ran === 0 && filtered && !multiPlace) {
	console.log("✗ No spec or end-to-end test matches the filter; `mise run test` runs them all.");
	process.exit(1);
}
process.exit(failed > 0 ? 1 : 0);
