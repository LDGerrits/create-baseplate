// Claude Code's Stop hook for this repo: when files changed, run the root check (the CLI and the docs
// site) and, for each template whose code changed (cli/template/<language>/base), that template's
// check, and hand a failure back to the agent before it ends its turn, as a created game's hook does.
// A check that already passed on exactly these files is skipped (scripts/repo-check.ts). Only what
// fails is handed back, shortened to its end. If the agent already had its chance in this stop, it may
// stop, so the hook can't loop, and the user is told the check fails.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { alreadyPassed } from "../../cli/template/typescript/base/.agents/hooks/fingerprint.ts";
import { ROOT_RECORD, readRecord, scopeOf, shorten, stateId, templatesOf } from "../../scripts/repo-check.ts";

let payload: { cwd?: string; stop_hook_active?: boolean } = {};
try {
	payload = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {}

// The session's own checkout, from its folder: in a worktree session, CLAUDE_PROJECT_DIR can name the
// main one.
const git = (...args: string[]) => {
	const run = spawnSync("git", ["-C", payload.cwd ?? ".", ...args], {
		encoding: "utf8",
	});
	return run.status === 0 ? run.stdout : "";
};
const root = git("rev-parse", "--show-toplevel").trim();
if (root === "") process.exit(0);
process.chdir(root);

const changed = [
	...git("diff", "-z", "--name-only", "HEAD").split("\0"),
	...git("ls-files", "-z", "--others", "--exclude-standard").split("\0"),
].filter((file) => file !== "");

const failures: { name: string; output: string }[] = [];
const run = (name: string, command: string, args: string[], cwd: string) => {
	const done = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		shell: process.platform === "win32",
		maxBuffer: 64 * 1024 * 1024,
	});
	if (done.error === undefined && done.status !== 0) failures.push({ name, output: `${done.stdout}${done.stderr}` });
};

if (scopeOf(changed) !== "none") {
	const state = stateId(root, "files");
	if (state === undefined || readRecord(root, ROOT_RECORD) !== state) {
		run("mise run check", process.execPath, ["scripts/check.ts", "--quiet"], root);
	}
}
for (const base of templatesOf(changed)) {
	const dir = path.join(root, base);
	if (!alreadyPassed(dir, "files")) run(`mise run check in ${base}`, "mise", ["run", "--quiet", "check"], dir);
}
if (failures.length === 0) process.exit(0);

const each = Math.floor(2400 / failures.length);
const output = failures.map(({ name, output }) => `${name}:\n${shorten(output, each)}`).join("\n\n");
const names = failures.map(({ name }) => `\`${name}\``).join(" and ");
if (payload.stop_hook_active === true) {
	console.log(JSON.stringify({ systemMessage: `The agent stopped, but ${names} still fails:\n${output}` }));
} else {
	const reason = `${names} fails after your changes. Fix it, or tell the user why it stays failing:\n${output}`;
	console.log(JSON.stringify({ decision: "block", reason }));
}
