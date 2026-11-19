// Runs the tests offline in ree, the Roblox engine emulator: the Jest specs, then every end-to-end
// harness in tests/e2e. Run it through `mise run test`, which compiles first.
// A run fails on a non-zero exit, on any script error (ree counts errors from scripts other than the
// harness without failing the run), and, for an end-to-end test, when it never prints "@done".
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const runs = [
	{
		name: "jest",
		harness: "scripts/test/jest.luau",
		args: ["--run-context", "server", "--seconds", "60"],
	},
	...fs
		.readdirSync("tests/e2e")
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
		["run", "--rojo", "default.project.json", "--load-string", "--harness", run.harness, ...run.args],
		{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
	);
	const seconds = ((performance.now() - started) / 1000).toFixed(2);

	let summary;
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
