// Stop hook for Claude Code, Codex and Cursor: when files changed, run `mise run check` (about five
// seconds) and hand any failure back to the agent before it ends its turn. Pass "cursor" as the
// first argument for Cursor, which replies with followup_message.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { projectRoot } from "./project.ts";

interface Payload {
	cwd?: string;
	stop_hook_active?: boolean; // Claude Code and Codex: this stop already continued once
	loop_count?: number; // Cursor: follow-ups so far
	workspace_roots?: string[]; // Cursor
}

let payload: Payload = {};
try {
	payload = JSON.parse(fs.readFileSync(0, "utf8")) as Payload;
} catch {}
const cursor = process.argv[2] === "cursor";
// The agent already had one chance to fix a failure in this stop; don't loop.
if (payload.stop_hook_active === true || (payload.loop_count ?? 0) > 0) process.exit(0);

// The session's own folder: in a worktree session, CLAUDE_PROJECT_DIR still names the main checkout.
const start = payload.cwd ?? payload.workspace_roots?.[0] ?? process.env.CLAUDE_PROJECT_DIR ?? ".";
const root = projectRoot(start);
if (root === undefined) process.exit(0);
process.chdir(root);

const git = (...args: string[]) => {
	const run = spawnSync("git", args, { encoding: "utf8" });
	return run.status === 0 ? run.stdout : "";
};
const changed = [
	...git("diff", "-z", "--name-only", "--relative", "HEAD").split("\0"),
	...git("ls-files", "-z", "--others", "--exclude-standard").split("\0"),
].filter((file) => file !== "" && !file.endsWith(".md"));
if (changed.length === 0) process.exit(0);

const check = spawnSync("mise", ["run", "--quiet", "check"], {
	encoding: "utf8",
	shell: process.platform === "win32",
	maxBuffer: 64 * 1024 * 1024,
});
if (check.error !== undefined || check.status === 0) process.exit(0);

const output = `${check.stdout}${check.stderr}`.trim();
const message = `\`mise run check\` fails after your changes. Fix it, or tell the user why it stays failing:\n${output.slice(-6000)}`;
console.log(JSON.stringify(cursor ? { followup_message: message } : { decision: "block", reason: message }));
