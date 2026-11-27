// The check's lint step: ESLint over src/ (and projects/, in a multi-place game), failing on any
// problem, as `eslint --max-warnings 0` would.
//
//   node scripts/lint.ts [--wait] [--fix]
//
// With --fix, as `mise run check` runs it (not `mise run ci`), it applies the fixes ESLint can make,
// as the format step does for formatting, except those that would undo half-written code (UNFIXED_BY_CHECK).
//
// Loading ESLint's config and plugins takes most of its time, and doesn't depend on the files it
// lints. With --fix, the edit hook's ESLint server (.agents/hooks/eslint-server.ts) has usually
// loaded them already, and lints for it in a fraction of a second. Otherwise, with --wait, as the
// check starts it, it loads them itself first, then waits for a line on its input before it lints:
// the check sends that line once the generated files and the formatting are done, so the loading
// overlaps them and the lint sees the same files it would have seen starting then.
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { ESLint } from "eslint";
import { ask, changedFiles, fixable, snapshot, socketPath } from "../.agents/hooks/eslint-server.ts";

const fix = process.argv.includes("--fix");
const root = process.cwd();

/** Whether the project's ESLint server is listening. */
const serverUp = () =>
	new Promise<boolean>((resolve) => {
		const probe = net.connect(socketPath(root));
		probe.on("connect", () => {
			probe.destroy();
			resolve(true);
		});
		probe.on("error", () => resolve(false));
	});

// The server always applies its fixes, so only the fixing check may use it, and never when it's
// turned off for this project.
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
		// The input closed without the line: a step this one needs failed, so there's nothing to lint.
		process.stdin.once("end", () => process.exit(0));
	});
	process.stdin.destroy();
}

const targets = ["src", "projects"].filter((dir) => fs.existsSync(dir));
if (targets.length === 0) process.exit(0);

// The check's other steps read the files before these fixes; it checks them again (scripts/check.ts).
const FIXED = "@eslint-fixed";

if (viaServer) {
	// Only a server that's already up and current: a stale one, or none, means linting here, so no
	// two linters ever write fixes to the same files. A whole project may take a while.
	const before = snapshot(root);
	const reply = await ask(root, targets, 120_000, true);
	const results = reply !== undefined && "results" in reply ? reply.results : undefined;
	if (results !== undefined) {
		if (changedFiles(before, snapshot(root)).length > 0) console.log(FIXED);
		const problems = results.flatMap(({ filePath, messages }) =>
			messages.map(
				({ line, ruleId, message }) => `${path.relative(root, filePath)}:${line}  ${message}  ${ruleId ?? ""}`,
			),
		);
		if (problems.length > 0) {
			console.log(`${problems.join("\n")}\n\n✖ ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
			process.exit(1);
		}
		process.exit(0);
	}
}

// No server to ask, or it couldn't answer: lint here, loading ESLint now if the server was expected.
const linter =
	eslint ??
	new ESLint({
		errorOnUnmatchedPattern: false,
		fix: fix ? (message) => fixable(message.ruleId, true) : false,
	});
const results = await linter.lintFiles(targets);
if (fix && results.some((result) => result.output !== undefined)) {
	await ESLint.outputFixes(results);
	console.log(FIXED);
}
const problems = results.reduce((sum, result) => sum + result.errorCount + result.warningCount, 0);
if (problems > 0) {
	process.stdout.write(await (await linter.loadFormatter("stylish")).format(results));
	process.exit(1);
}
