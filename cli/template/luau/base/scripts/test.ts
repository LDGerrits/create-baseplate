// Runs the tests offline in ree, the Roblox engine emulator: the Jest specs, then every end-to-end
// harness in tests/e2e. Run it through `mise run test`, which writes the project files first. It runs the game of
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

// Wally's package folders, which carry specs of their own.
const PACKAGES = /(^|\/)(Packages|ServerPackages|DevPackages|node_modules)(\/|$)/;

// Whether the game holds any spec ree runs: a *.spec.luau in a folder its project mounts, and that
// its globIgnorePaths don't leave out. A place of a multi-place game may hold none (the shared
// code's specs run in one place), and then the Jest run is skipped rather than started for nothing.
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
const projectFile = JSON.parse(fs.readFileSync(project, "utf8")) as { globIgnorePaths?: string[] };
collectMounts(projectFile);
const ignored = (file: string) => (projectFile.globIgnorePaths ?? []).some((glob) => path.matchesGlob(file, glob));
const isSpec = (file: string) => file.endsWith(".spec.luau") && !file.endsWith(".engine.spec.luau") && !ignored(file);
// A folder mount holds specs among its files; Rogen mounts some folders file by file (one split to
// leave out the shared specs in a multi-place game), and then a spec is a mount of its own.
const hasSpecs = mounts.some((mount) => {
	if (PACKAGES.test(mount) || !fs.existsSync(mount)) return false;
	if (!fs.statSync(mount).isDirectory()) return isSpec(mount);
	return fs
		.readdirSync(mount, { recursive: true, encoding: "utf8" })
		.some((file) => isSpec(path.posix.join(mount, file.split(path.sep).join("/"))));
});

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

// Traces name the game's instances (`ServerScriptService.features.shop.ShopService:17`). Each
// such frame gets the file it comes from, through the project file; Luau runs as written, so the
// line is the same.
const sourceFiles = new Map<string, string>();
const indexTree = (node: unknown, names: string[]) => {
	if (typeof node !== "object" || node === null) return;
	for (const [key, value] of Object.entries(node)) {
		if (key === "$path") {
			const mount = typeof value === "string" ? value : (value as { optional: string }).optional;
			if (!PACKAGES.test(mount)) indexMount(mount, names);
		} else if (!key.startsWith("$")) indexTree(value, [...names, key]);
	}
};
const indexMount = (mount: string, names: string[]) => {
	if (!fs.existsSync(mount)) return;
	if (fs.statSync(mount).isFile()) {
		if (mount.endsWith(".luau")) sourceFiles.set(names.join("."), mount);
		return;
	}
	for (const file of fs.readdirSync(mount, { recursive: true, encoding: "utf8" })) {
		if (!file.endsWith(".luau")) continue;
		const parts = file.split(path.sep);
		const name = (parts.pop() ?? "").replace(/(\.server|\.client)?\.luau$/, "");
		sourceFiles.set([...names, ...parts, ...(name === "init" ? [] : [name])].join("."), path.join(mount, file));
	}
};
indexTree(JSON.parse(fs.readFileSync(project, "utf8")).tree, []);
// ree loads each end-to-end test as ReplicatedStorage.RURFixtures.<name>.
for (const run of runs) {
	if (run.name.startsWith("e2e/")) sourceFiles.set(`ReplicatedStorage.RURFixtures.${run.name.slice(4)}`, run.harness);
}

/** Adds the file and line after each frame in the game's own code. */
const withSources = (text: string) =>
	text.replace(/[\w@-]+(?:\.[\w@-]+)+:(\d+)/g, (frame, line: string) => {
		const source = sourceFiles.get(frame.slice(0, frame.lastIndexOf(":")));
		return source
			? `${frame} → ${path.relative(process.env.ROOT ?? process.cwd(), path.resolve(source))}:${line}`
			: frame;
	});

// Jest colours its report; the reader here is often an agent, or a log.
const plain = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

// Jest's report and traces run through its own code, the packages' and the test harness's; only the
// game's lines say where the failure is.
const NOT_OURS = /rbxts_include|node_modules|_Index|DevPackages|\brur\.\w+:|RURFixtures\.jest\b/;
// Only a frame line goes, never a message, which can name a package's file too.
const FRAME = /^\s*\S+:\d+(\s|$)/;
const ownLines = (text: string) =>
	text
		.split("\n")
		.filter((line, index) => index === 0 || !(FRAME.test(line) && NOT_OURS.test(line)))
		.join("\n");

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
		// The harness's own "Jest: tests failed" repeats the report above it.
		if (line.message === "@done" || line.message.startsWith("@jest ") || line.message === "Jest: tests failed")
			continue;
		const side = line.side ? `[${line.side}] ` : "";
		const kind = line.kind === "print" ? "" : `${line.kind}: `;
		console.log(`  ${side}${kind}${withSources(ownLines(plain(line.message))).replaceAll("\n", "\n  ")}`);
		if (line.trace) console.log(`    ${withSources(ownLines(plain(line.trace)).trim()).replaceAll("\n", "\n    ")}`);
	}
	// A test that waited for something that never came: it timed out, or ran out its seconds.
	const timedOut =
		output.some((line) => line.kind !== "print" && /timed out/i.test(line.message)) ||
		(summary.errors === 0 && problems.some((problem) => String(problem).includes("@done")));
	if (run.name.startsWith("e2e/") && timedOut) {
		console.log(
			"  If it waits on a touch, physics or a character: ree doesn't emulate them. Test that in an *.engine.spec, run in Roblox by `mise run test:engine`.",
		);
	}
}

// A filter that matches nothing is a typo more often than a pass. In a multi-place game a test lives
// in one place, so another place matching nothing is fine.
const multiPlace = fs.existsSync(path.join(process.env.ROOT ?? ".", "projects"));
const filtered = filter.testPathPattern !== undefined || filter.testNamePattern !== undefined;
if (failed === 0 && ran === 0 && filtered && !multiPlace) {
	console.log("✗ No spec or end-to-end test matches the filter; `mise run test` runs them all.");
	process.exit(1);
}
process.exit(failed > 0 ? 1 : 0);
