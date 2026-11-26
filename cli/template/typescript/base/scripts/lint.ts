// The check's lint step: ESLint over src/ (and projects/, in a multi-place game), failing on any
// problem, as `eslint --max-warnings 0` would.
//
//   node scripts/lint.ts [--wait]
//
// Loading ESLint's config and plugins takes most of its time, and doesn't depend on the files it
// lints. With --wait, as the check starts it, it loads them first, then waits for a line on its input
// before it lints: the check sends that line once the generated files and the formatting are done, so
// the loading overlaps them and the lint sees the same files it would have seen starting then.
import fs from "node:fs";
import { ESLint } from "eslint";

const eslint = new ESLint({ errorOnUnmatchedPattern: false });
// Any path under src/ loads the whole config; the file needn't exist.
await eslint.calculateConfigForFile("src/index.ts");
const formatter = await eslint.loadFormatter("stylish");

if (process.argv.includes("--wait")) {
	await new Promise<void>((resolve) => {
		process.stdin.once("data", () => resolve());
		// The input closed without the line: a step this one needs failed, so there's nothing to lint.
		process.stdin.once("end", () => process.exit(0));
	});
	process.stdin.destroy();
}

const targets = ["src", "projects"].filter((dir) => fs.existsSync(dir));
const results = targets.length === 0 ? [] : await eslint.lintFiles(targets);
const problems = results.reduce((sum, result) => sum + result.errorCount + result.warningCount, 0);
if (problems > 0) {
	process.stdout.write(await formatter.format(results));
	process.exit(1);
}
