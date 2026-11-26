// The pre-commit hook (.githooks/pre-commit): runs lint-staged on exactly what is being committed,
// with unstaged changes and untracked files set aside, so the check sees only the commit. Biome
// formats the staged files and lint-staged re-stages them; then the whole check runs once, because
// type errors and failing tests reach past the staged files. Deleted files count, so a commit that
// only deletes is checked too.
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

const quoted = (files: string[]) => files.map((file) => JSON.stringify(file)).join(" ");

/** The format command for the staged files still on disk. */
function format(files: readonly string[]) {
	const present = files.filter((file) => fs.existsSync(file));
	return present.length === 0
		? []
		: [`biome check --write --no-errors-on-unmatched --files-ignore-unknown=true ${quoted(present)}`];
}

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

const lintStaged = await import("lint-staged").then(
	(module) => module.default,
	(error: Error) => {
		console.error(`pre-commit: couldn't load lint-staged (${error.message}). Run \`mise run install\` first.`);
	},
);
const passed =
	lintStaged !== undefined &&
	(await lintStaged({ config: { "*": [format, () => "mise run ci"] }, hideAll: true, diffFilter: "ACMRD" }).catch(
		(error: Error) => {
			console.error("pre-commit: lint-staged couldn't run:", error);
			return false;
		},
	));

for (const file of kept) {
	if (!fs.existsSync(file)) {
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.copyFileSync(path.join(backup, file), file);
	}
}
fs.rmSync(backup, { recursive: true, force: true });
process.exit(passed ? 0 : 1);
