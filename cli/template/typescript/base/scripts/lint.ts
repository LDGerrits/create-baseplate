import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { ESLint } from "eslint";
import { ask, fixable, socketPath } from "../.agents/hooks/eslint-server.ts";

const fix = process.argv.includes("--fix");
const root = process.cwd();

const serverUp = () =>
	new Promise<boolean>((resolve) => {
		const probe = net.connect(socketPath(root));
		probe.on("connect", () => {
			probe.destroy();
			resolve(true);
		});
		probe.on("error", () => resolve(false));
	});

const viaServer = fix && process.env.BASEPLATE_ESLINT_SERVER !== "0" && (await serverUp());
const eslint = viaServer
	? undefined
	: new ESLint({
			errorOnUnmatchedPattern: false,
			fix: fix ? (message) => fixable(message.ruleId, true) : false,
		});
// Any path under src/ loads the whole config; the file needn't exist.
await eslint?.calculateConfigForFile("src/index.ts");

if (process.argv.includes("--wait")) {
	await new Promise<void>((resolve) => {
		process.stdin.once("data", () => resolve());
		process.stdin.once("end", () => process.exit(0));
	});
	process.stdin.destroy();
}

const targets = ["src", "projects"].filter((dir) => fs.existsSync(dir));
if (targets.length === 0) process.exit(0);

function report(
	results: { filePath: string; messages: { line: number; ruleId: string | null; message: string }[] }[],
): never {
	const problems = results.flatMap(({ filePath, messages }) =>
		messages.map(
			({ line, ruleId, message }) => `${path.relative(root, filePath)}:${line}  ${message}  ${ruleId ?? ""}`,
		),
	);
	if (problems.length === 0) process.exit(0);
	console.log(`${problems.join("\n")}\n\n✖ ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
	process.exit(1);
}

if (viaServer) {
	const reply = await ask(root, targets, 120_000, true);
	const results = reply !== undefined && "results" in reply ? reply.results : undefined;
	if (results !== undefined) report(results);
}

const linter =
	eslint ??
	new ESLint({
		errorOnUnmatchedPattern: false,
		fix: fix ? (message) => fixable(message.ruleId, true) : false,
	});
const results = await linter.lintFiles(targets);
if (fix && results.some((result) => result.output !== undefined)) {
	await ESLint.outputFixes(results);
}
report(results);
