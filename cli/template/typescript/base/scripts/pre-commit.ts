// Git's stash, which lint-staged uses for that, deletes a file whose deletion is staged but that
// is still on disk, such as `.env` after `git rm --cached .env`, and lint-staged drops the stash
// once the check passes. So copy those files first and put back any that went missing.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { commitSkip, stagedFiles } from "../.agents/hooks/fingerprint.ts";

const quoted = (files: string[]) => files.map((file) => JSON.stringify(file)).join(" ");

// Windows refuses a command line over 8,191 characters, which the first commit's few hundred files
// pass as absolute paths: each command gets paths from here, in groups well under that.
const MAX_LINE = 6000;
const commands = (prefix: string, files: string[]) => {
	const groups: string[][] = [[]];
	let length = prefix.length;
	for (const file of files.map((one) => path.relative(process.cwd(), one))) {
		const last = groups.at(-1) ?? [];
		if (last.length > 0 && length + file.length + 3 > MAX_LINE) {
			groups.push([file]);
			length = prefix.length + file.length + 3;
		} else {
			last.push(file);
			length += file.length + 3;
		}
	}
	return groups.filter((group) => group.length > 0).map((group) => `${prefix} ${quoted(group)}`);
};
const ours = (file: string) => !path.relative(process.cwd(), file).split(path.sep).includes(".baseplate");

function format(files: readonly string[]) {
	return commands(
		"biome check --write --no-errors-on-unmatched --files-ignore-unknown=true",
		files.filter((file) => fs.existsSync(file) && ours(file)),
	);
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
	(await lintStaged({
		config: { "*": [format, () => "mise run ci"] },
		hideAll: true,
		diffFilter: "ACMRD",
		quiet: true,
	}).catch((error: Error) => {
		console.error("pre-commit: lint-staged couldn't run:", error);
		return false;
	}));

for (const file of kept) {
	if (!fs.existsSync(file)) {
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.copyFileSync(path.join(backup, file), file);
	}
}
fs.rmSync(backup, { recursive: true, force: true });
if (!passed)
	console.error(
		"pre-commit: the commit stopped; the check's output, if any, is above. Run `mise run ci` to see it again.",
	);
process.exit(passed ? 0 : 1);
