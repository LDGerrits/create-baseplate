// Runs the tests offline in ree, the Roblox engine emulator: the Jest specs, then every end-to-end
// harness in tests/e2e. Run it through `mise run test`, which compiles first.
// A run fails on a non-zero exit, on any script error (ree counts errors from scripts other than the
// harness without failing the run), on reaching an engine member ree doesn't emulate, and, for an
// end-to-end test, when it never prints "@done".
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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
collectMounts(JSON.parse(fs.readFileSync("game.project.json", "utf8")));
// Only the compiled code: packages in node_modules carry specs of their own.
const hasSpecs = mounts.some(
	(mount) =>
		/(^|\/)out\//.test(mount) &&
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
					args: ["--run-context", "server", "--seconds", "60"],
				},
			]
		: []),
	...(fs.existsSync("tests/e2e") ? fs.readdirSync("tests/e2e") : [])
		.filter((file) => file.endsWith(".luau"))
		.sort()
		.map((file) => ({
			name: `e2e/${path.basename(file, ".luau")}`,
			harness: path.join("tests/e2e", file),
			args: ["--run-context", "loopback", "--mode", "play", "--player", "Tester", "--seconds", "30"],
			needsDone: true,
		})),
];

let failed = 0;
for (const run of runs) {
	const started = performance.now();
	const ree = spawnSync(
		"ree",
		["run", "--rojo", "game.project.json", "--load-string", "--harness", run.harness, ...run.args],
		{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
	);
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
		console.log(`  ${side}${kind}${line.message.replaceAll("\n", "\n  ")}`);
		if (line.trace) console.log(`    ${line.trace.trim().replaceAll("\n", "\n    ")}`);
	}
}

process.exit(failed > 0 ? 1 : 0);
