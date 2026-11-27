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

const env = quiet
	? { ...process.env, NODE_OPTIONS: "--test-reporter=dot", NO_COLOR: "1", FORCE_COLOR: "0" }
	: process.env;
const turbo = (...args: string[]) => [
	"turbo",
	"run",
	...args,
	...(quiet ? ["--output-logs=errors-only", "--log-order=grouped"] : []),
];

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
	if (index === commands.length - 1) formatted = stateId(root, "files");
}

if (!flag("no-record") && formatted !== undefined && stateId(root, "files") === formatted) {
	writeRecord(root, scope === "docs" ? DOCS_RECORD : ROOT_RECORD, formatted);
}
if (quiet) console.log(`✓ ${name}${scope === "docs" ? " (docs only)" : ""} passed in ${seconds()}s`);
