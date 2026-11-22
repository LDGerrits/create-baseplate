// Claude Code's Stop hook for this repo: when files changed, run the root `mise run check` (the CLI
// and the docs site) and hand a failure back to the agent before it ends its turn, as a created
// game's hook does. If the agent already had its chance in this stop, it may stop, so the hook can't
// loop, and the user is told the check fails. A change to the template needs its own check too:
// run `mise run check` in cli/template/<language>/base, as AGENTS.md says.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

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
if (changed.length === 0) process.exit(0);

const check = spawnSync("mise", ["run", "--quiet", "check"], {
	encoding: "utf8",
	shell: process.platform === "win32",
	maxBuffer: 64 * 1024 * 1024,
});
if (check.error !== undefined || check.status === 0) process.exit(0);

const output = `${check.stdout}${check.stderr}`.trim();
if (payload.stop_hook_active === true) {
	console.log(
		JSON.stringify({ systemMessage: `The agent stopped, but \`mise run check\` still fails:\n${output.slice(-2000)}` }),
	);
} else {
	const reason = `\`mise run check\` fails after your changes. Fix it, or tell the user why it stays failing:\n${output.slice(-6000)}`;
	console.log(JSON.stringify({ decision: "block", reason }));
}
