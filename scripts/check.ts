// The check for the CLI and the docs site: `mise run check` (formats), `mise run ci` (`--ci`: fails on
// unformatted code instead), and what the hooks run.
//
//   node scripts/check.ts [--ci] [--quiet] [--scope full|docs] [--no-install] [--no-record]
//
// --quiet prints nothing for what passes, and for what fails only the failing task's output and a
// line saying how it went, which is what the hooks hand back to a person or an agent. Without it
// everything streams, as on CI.
// --scope docs is for a change to the docs only: the docs site's own tasks and the CLI's tests that
// read the docs, not the rest of the CLI's tests.
// When the whole check passes it records the tree of the files it passed on (scripts/repo-check.ts),
// which the Stop hook and the commit hook read to skip a check that already passed on this state.
// --no-install and --no-record are for a copy of what is staged, whose packages are linked in.
import { spawn } from "node:child_process";
import { DOCS_RECORD, ROOT_RECORD, type Scope, shorten, stateId, writeRecord } from "./repo-check.ts";

const flag = (name: string) => process.argv.includes(`--${name}`);
const ci = flag("ci");
const quiet = flag("quiet");
const scope = (process.argv[process.argv.indexOf("--scope") + 1] === "docs" ? "docs" : "full") satisfies Scope;
const root = process.cwd();
const started = performance.now();

// The tests' own reporter prints a dot for each pass and the details of each failure only.
const env = quiet
	? { ...process.env, NODE_OPTIONS: "--test-reporter=dot", NO_COLOR: "1", FORCE_COLOR: "0" }
	: process.env;
const turbo = (...args: string[]) => [
	"turbo",
	"run",
	...args,
	...(quiet ? ["--output-logs=errors-only", "--log-order=grouped"] : []),
];

const commands: { command: string[]; cwd?: string }[] = [
	...(flag("no-install") ? [] : [{ command: ["pnpm", "install", "--frozen-lockfile", "--silent"] }]),
	{ command: ci ? ["biome", "ci", "."] : ["biome", "check", "--write", "."] },
];
const afterFormat: { command: string[]; cwd?: string }[] =
	scope === "docs"
		? [
				{ command: turbo("build", "typecheck") },
				{ command: turbo("test", "--filter=www") },
				{
					command: ["node", "--test", "test/docs.test.ts", "test/doc.test.ts"],
					cwd: "cli",
				},
			]
		: [{ command: turbo("build", "typecheck", "test") }];

function run({ command, cwd }: { command: string[]; cwd?: string }): Promise<{ ok: boolean; output: string }> {
	return new Promise((resolve) => {
		const [file = "", ...args] = command;
		const child = spawn(file, args, {
			cwd: cwd === undefined ? root : `${root}/${cwd}`,
			env,
			stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit",
		});
		let output = "";
		child.stdout?.on("data", (chunk: Buffer) => {
			output += chunk.toString("utf8");
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			output += chunk.toString("utf8");
		});
		child.on("error", (error) => resolve({ ok: false, output: `${file}: ${error.message}` }));
		child.on("close", (code) => resolve({ ok: code === 0, output }));
	});
}

const name = ci ? "ci" : "check";
const seconds = () => ((performance.now() - started) / 1000).toFixed(1);
let formatted: string | undefined;
for (const [index, step] of [...commands, ...afterFormat].entries()) {
	const result = await run(step);
	if (!result.ok) {
		if (quiet) console.log(`$ ${step.command.join(" ")}\n${shorten(result.output)}`);
		console.log(
			`✗ ${name} failed in ${seconds()}s: ${step.command.filter((word) => !word.startsWith("--output") && !word.startsWith("--log")).join(" ")}`,
		);
		process.exit(1);
	}
	// Formatting is done: these are the files the rest checks.
	if (index === commands.length - 1) formatted = stateId(root, "files");
}

// Record the pass only for a state that held from the end of formatting to the end of the check.
if (!flag("no-record") && formatted !== undefined && stateId(root, "files") === formatted) {
	writeRecord(root, scope === "docs" ? DOCS_RECORD : ROOT_RECORD, formatted);
}
if (quiet) console.log(`✓ ${name}${scope === "docs" ? " (docs only)" : ""} passed in ${seconds()}s`);
