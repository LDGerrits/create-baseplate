// The pre-commit hook (.githooks/pre-commit): runs lint-staged.config.ts on exactly what is being
// committed. `--hide-all` sets unstaged changes and untracked files aside while the check runs.
// It skips the check when only Markdown is staged, or when the check already passed on exactly the
// files being committed (the index, not what else is on disk); see .agents/hooks/fingerprint.ts.
//
// Git's stash, which lint-staged uses for that, deletes a file whose deletion is staged but that
// is still on disk, such as `.env` after `git rm --cached .env`, and lint-staged drops the stash
// once the check passes. So copy those files first and put back any that went missing.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { commitSkip, stagedFiles } from "../.agents/hooks/fingerprint.ts";

const skip = commitSkip(process.cwd(), stagedFiles(process.cwd()));
if (skip !== undefined) {
	console.log(`pre-commit: check skipped: ${skip}.`);
	process.exit(0);
}

const staged = spawnSync("git", ["diff", "--cached", "--name-only", "--relative", "--diff-filter=D", "-z"], {
	encoding: "utf8",
});
const kept = staged.stdout.split("\0").filter((file) => file !== "" && fs.existsSync(file));

const backup = fs.mkdtempSync(path.join(os.tmpdir(), "pre-commit-"));
for (const file of kept) {
	fs.mkdirSync(path.dirname(path.join(backup, file)), { recursive: true });
	fs.copyFileSync(file, path.join(backup, file));
}

// ACMRD: deleted files count, or a commit that only deletes would skip the check.
const lintStaged = spawnSync("lint-staged", ["--hide-all", "--diff-filter=ACMRD"], {
	stdio: "inherit",
	shell: process.platform === "win32",
});
if (lintStaged.error !== undefined) {
	console.error(`pre-commit: couldn't run lint-staged (${lintStaged.error.message}). Run \`mise run install\` first.`);
}

for (const file of kept) {
	if (!fs.existsSync(file)) {
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.copyFileSync(path.join(backup, file), file);
	}
}
fs.rmSync(backup, { recursive: true, force: true });
process.exit(lintStaged.status ?? 1);
