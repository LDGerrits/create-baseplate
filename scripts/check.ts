// The check for the CLI and the docs site, as `mise run check` (fixes formatting) and `mise run ci`
// (`--ci`: fails on unformatted code) run it, and as the hooks do.
//   node scripts/check.ts [--ci] [--quiet] [--scope full|docs] [--no-install] [--no-record]
// --quiet prints only a failure; --scope docs runs the docs site's tasks and the CLI's tests that
// read the docs; --no-install and --no-record are for a copy of the staged files with its packages
// linked in. A pass of the whole check is recorded (scripts/state.ts).
import fs from "node:fs";
import { DOCS_RECORD, ROOT_RECORD, type Scope, shorten } from "./repo-check.ts";
import { run } from "./run.ts";
import { stateId, writeRecord } from "./state.ts";

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

/** The workflows actionlint checks: this repository's and each template's. */
const workflowFiles = (dir: string) =>
	[
		".github/workflows",
		...fs.readdirSync(`${dir}/cli/template`).map((language) => `cli/template/${language}/base/.github/workflows`),
	]
		.filter((folder) => fs.existsSync(`${dir}/${folder}`))
		.flatMap((folder) =>
			fs
				.readdirSync(`${dir}/${folder}`)
				.filter((file) => /\.ya?ml$/.test(file))
				.map((file) => `${folder}/${file}`),
		);

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
		: [{ command: ["actionlint", ...workflowFiles(root)] }, { command: turbo("build", "typecheck", "test") }];

const name = ci ? "ci" : "check";
const seconds = () => ((performance.now() - started) / 1000).toFixed(1);
let formatted: string | undefined;
for (const [index, step] of [...commands, ...afterFormat].entries()) {
	const [file = "", ...args] = step.command;
	const result = await run(file, args, step.cwd === undefined ? root : `${root}/${step.cwd}`, {
		env,
		echo: quiet ? "none" : "inherit",
	});
	if (result.code !== 0) {
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
