// Agent Stop hook: when code changed, run the offline tests (`mise run test`, about two seconds)
// and hand any failure back to the agent before it ends its turn.
// Pass "cursor" as the first argument for Cursor, which replies with followup_message.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

let payload = {};
try {
	payload = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {}
// The agent already had one chance to fix a failure in this stop; don't loop.
if (payload.stop_hook_active) process.exit(0);
try {
	process.chdir(process.env.CLAUDE_PROJECT_DIR || payload.cwd || ".");
} catch {
	process.exit(0);
}

const git = (...args) => {
	const run = spawnSync("git", args, { encoding: "utf8" });
	return run.status === 0 ? run.stdout : "";
};
const changed = [
	...git("diff", "-z", "--name-only", "--relative", "HEAD").split("\0"),
	...git("ls-files", "-z", "--others", "--exclude-standard").split("\0"),
].filter((file) => /^(src|tests|scripts)\//.test(file));
if (changed.length === 0) process.exit(0);

const test = spawnSync("mise", ["run", "--quiet", "test"], {
	encoding: "utf8",
	shell: process.platform === "win32",
	maxBuffer: 64 * 1024 * 1024,
});
if (test.error || test.status === 0) process.exit(0);

const output = `${test.stdout ?? ""}${test.stderr ?? ""}`.trim();
const message = `The tests fail after your changes. Fix them, or tell the user why they stay failing:\n${output.slice(-6000)}`;
console.log(
	JSON.stringify(process.argv[2] === "cursor" ? { followup_message: message } : { decision: "block", reason: message }),
);
