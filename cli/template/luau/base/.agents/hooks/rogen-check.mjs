// Agent Stop hook: report new Rogen diagnostics about changed files before the agent ends its turn.
// Pass "cursor" as the first argument for Cursor, which replies with followup_message.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const git = (...args) => {
	const run = spawnSync("git", args, { encoding: "utf8" });
	return run.status === 0 ? run.stdout : "";
};

let payload = {};
try {
	payload = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {}
const session = String(
	payload.session_id ??
		payload.sessionId ??
		payload.conversation_id ??
		"agent",
).replace(/[^\w.-]/g, "_");
// The session's own folder comes first: in a worktree, CLAUDE_PROJECT_DIR can name the main checkout.
try {
	process.chdir(payload.cwd || process.env.CLAUDE_PROJECT_DIR || ".");
} catch {
	process.exit(0);
}
const start = process.cwd();
const top = git("rev-parse", "--show-toplevel").trim();
if (top) process.chdir(top);

const changed = [
	...git(
		"diff",
		"-z",
		"--name-only",
		"--relative",
		"--diff-filter=d",
		"HEAD",
	).split("\0"),
	...git("ls-files", "-z", "--others", "--exclude-standard").split("\0"),
].filter(Boolean);
if (!changed.length) process.exit(0);

const seenFile = path.resolve(
	git("rev-parse", "--git-dir").trim(),
	`rogen-hook-${session}`,
);
const seen = fs.existsSync(seenFile)
	? fs.readFileSync(seenFile, "utf8").split("\n")
	: [];

const windows = process.platform === "win32";
const names = windows ? ["rogen.cmd", "rogen.exe"] : ["rogen"];
const locate = (dirs) =>
	dirs
		.flatMap((dir) => names.map((name) => path.join(dir, name)))
		.find((file) => fs.existsSync(file));
const folders = [start];
for (let dir = start; dir !== process.cwd() && path.dirname(dir) !== dir; )
	folders.push((dir = path.dirname(dir)));
// A new git worktree has no node_modules, so look in the main checkout's too.
const main = top
	? path.dirname(path.resolve(git("rev-parse", "--git-common-dir").trim()))
	: process.cwd();
if (main !== process.cwd())
	folders.push(
		...folders.map((dir) => path.join(main, path.relative(top, dir))),
	);
const rogen = locate([
	...folders.map((dir) => path.join(dir, "node_modules/.bin")),
	...(process.env.PATH ?? "").split(path.delimiter).filter(Boolean),
]);
if (!rogen) {
	const NONE = "# found no rogen";
	if (!seen.includes(NONE)) {
		console.error(
			"Rogen's hook found no rogen; install it in the project or globally",
		);
		fs.appendFileSync(seenFile, `${NONE}\n`);
	}
	process.exit(0);
}

const run = (command, args) =>
	windows && command.endsWith(".cmd")
		? spawnSync([command, ...args].map((part) => `"${part}"`).join(" "), {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
				shell: true,
			})
		: spawnSync(command, args, {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
			});
const check = run(rogen, ["check", ...changed]);
const lines = (check.stdout ?? "").split(/\r?\n/).filter(Boolean);
const report = lines.filter((line) => !seen.includes(line));
// Keep only what the check still prints, so a problem fixed and made again is new again.
fs.writeFileSync(seenFile, lines.map((line) => `${line}\n`).join(""));
if (!report.length) process.exit(0);

const message = `Rogen reports these about files you changed. Fix each, or tell the user why it stays:\n${report.join("\n")}`;
console.log(
	JSON.stringify(
		process.argv[2] === "cursor"
			? { followup_message: message }
			: { decision: "block", reason: message },
	),
);
