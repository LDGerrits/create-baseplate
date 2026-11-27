import { spawnSync } from "node:child_process";
import path from "node:path";
import { DOCS_RECORD, exportIndex, ROOT_RECORD, scopeOf, shorten, templatesOf, withoutGitEnv } from "./repo-check.ts";
import { readRecord, recordFile, stagedFiles, stateId, writeRecord } from "./state.ts";

const git = (...args: string[]) => spawnSync("git", args, { encoding: "utf8" });

const top = git("rev-parse", "--show-toplevel").stdout.trim();
if (top === "") process.exit(0);
process.chdir(top);

for (const base of templatesOf(stagedFiles(top))) {
	const run = spawnSync("mise", ["exec", "--", "node", "scripts/pre-commit.ts"], {
		cwd: path.join(top, base),
		encoding: "utf8",
		shell: process.platform === "win32",
	});
	if (run.status !== 0) {
		console.log(`${shorten(`${run.stdout}${run.stderr}`, 4000)}\n✗ pre-commit: ${base}'s check failed`);
		process.exit(1);
	}
}

const stagedAfterTemplateHooks = stagedFiles(top);
const scope = scopeOf(stagedAfterTemplateHooks);
if (scope === "none") {
	console.log("pre-commit: nothing staged that the check reads.");
	process.exit(0);
}
const index = stateId(top, "index");
if (index !== undefined) {
	const passed = readRecord(top, ROOT_RECORD) === index || (scope === "docs" && readRecord(top, DOCS_RECORD) === index);
	if (passed) {
		console.log("pre-commit: the check already passed on exactly the staged files.");
		process.exit(0);
	}
}

const args = ["scripts/check.ts", "--ci", "--quiet", ...(scope === "docs" ? ["--scope", "docs"] : [])];
const onDisk = index !== undefined && stateId(top, "files") === index;
const copy = recordFile(top, "staged-check");
if (onDisk || index === undefined || copy === undefined) {
	process.exit(spawnSync(process.execPath, args, { stdio: "inherit" }).status ?? 1);
}
const { installed } = exportIndex(top, copy);
const run = spawnSync(process.execPath, [...args, "--no-record", ...(installed ? ["--no-install"] : [])], {
	cwd: copy,
	env: withoutGitEnv(),
	stdio: "inherit",
});
if (run.status === 0) writeRecord(top, scope === "docs" ? DOCS_RECORD : ROOT_RECORD, index);
process.exit(run.status ?? 1);
