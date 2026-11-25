// What "the same state" means for the check, so it runs once per state: the Stop hook and the commit
// hook skip it when the check already passed on exactly these files.
//
// A state is a git tree id. For the files on disk it is the tree `git add -A` would stage (tracked
// files, and untracked ones that aren't ignored), built in a copy of the index, so nothing changes
// in the real index and git applies its own rules for ignores, line endings, symbolic links and
// deleted files. For a commit it is the tree of the index itself, which is what the commit holds.
// The lockfiles, mise.lock and the pinned tool versions are tracked files, so they are in it.
//
// A pass is recorded in this worktree's own git folder, which no commit holds.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const git = (cwd: string, args: string[], env: Record<string, string> = {}) =>
	spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...env }, maxBuffer: 256 * 1024 * 1024 });

const out = (cwd: string, args: string[], env?: Record<string, string>): string | undefined => {
	const run = git(cwd, args, env);
	return run.status === 0 ? run.stdout.trim() : undefined;
};

/**
 * The tree of the files on disk (`files`) or of the index (`index`) in the repo that holds `cwd`, or
 * undefined when git can't say, in which case nothing should be skipped.
 */
export function stateId(cwd: string, source: "files" | "index"): string | undefined {
	if (source === "index") return out(cwd, ["write-tree"]);
	const real = process.env.GIT_INDEX_FILE ?? out(cwd, ["rev-parse", "--git-path", "index"]);
	if (real === undefined) return undefined;
	const copy = `${path.resolve(cwd, real)}.state-${process.pid}`;
	try {
		try {
			fs.copyFileSync(path.resolve(cwd, real), copy);
			// Git re-reads a file whose time isn't older than its index's, to catch a change made in the same
			// instant as the last `git add`. The copy keeps the index's time (less a millisecond), or it
			// would look newer and a same-size edit made just after that add would go unseen.
			const at = fs.statSync(path.resolve(cwd, real)).mtimeMs / 1000 - 0.001;
			fs.utimesSync(copy, at, at);
		} catch {
			// No index yet, as in a repo without a commit: start from an empty one.
		}
		const env = { GIT_INDEX_FILE: copy };
		if (git(cwd, ["add", "-A", "--", "."], env).status !== 0) return undefined;
		return out(cwd, ["write-tree"], env);
	} finally {
		fs.rmSync(copy, { force: true });
	}
}

/**
 * A hash of the files of `tree` that `belongs` picks, with their content: for steps that depend on
 * some files only, so they can be skipped while those are as they were when the step last passed.
 */
export function partId(cwd: string, tree: string, belongs: (file: string) => boolean): string | undefined {
	const listed = out(cwd, ["ls-tree", "-r", "--full-tree", "-z", tree]);
	if (listed === undefined) return undefined;
	// With --full-tree, paths are from the repo's top; the project may sit in a folder of it.
	const prefix = out(cwd, ["rev-parse", "--show-prefix"]) ?? "";
	const hash = createHash("sha256");
	for (const entry of listed.split("\0")) {
		const tab = entry.indexOf("\t");
		const file = entry.slice(tab + 1);
		if (tab === -1 || !file.startsWith(prefix) || !belongs(file.slice(prefix.length))) continue;
		hash.update(`${entry}\0`);
	}
	return hash.digest("hex");
}

/** Where the record named `name` is kept: in this worktree's git folder. */
export function recordFile(cwd: string, name: string): string | undefined {
	const at = out(cwd, ["rev-parse", "--git-path", name]);
	return at === undefined || at === "" ? undefined : path.resolve(cwd, at);
}

export function readRecord(cwd: string, name: string): string | undefined {
	const file = recordFile(cwd, name);
	try {
		return file === undefined ? undefined : fs.readFileSync(file, "utf8").trim();
	} catch {
		return undefined;
	}
}

export function writeRecord(cwd: string, name: string, id: string): void {
	const file = recordFile(cwd, name);
	try {
		if (file !== undefined) fs.writeFileSync(file, `${id}\n`);
	} catch {}
}

/** The record of the last state the whole check passed on. */
export const CHECK_RECORD = "check-passed";

/** Whether the whole check last passed on exactly this state. */
export function alreadyPassed(cwd: string, source: "files" | "index"): boolean {
	const id = stateId(cwd, source);
	return id !== undefined && id === readRecord(cwd, CHECK_RECORD);
}

/** Whether a file is Markdown, which nothing in the check reads. */
export const isMarkdown = (file: string) => /\.md$/i.test(file);

/** Whether every one of these changed files is Markdown. */
export function markdownOnly(files: string[]): boolean {
	return files.length > 0 && files.every(isMarkdown);
}

/** The paths staged for the commit being made (a rename counts as the old path and the new one). */
export function stagedFiles(cwd: string): string[] {
	const run = git(cwd, ["diff", "--cached", "--no-renames", "--name-only", "-z", "--relative"]);
	return run.status === 0 ? run.stdout.split("\0").filter((file) => file !== "") : [];
}

/** Why the commit hook needn't run the check on what's staged, or undefined when it must. */
export function commitSkip(cwd: string, staged: string[]): string | undefined {
	if (markdownOnly(staged)) return "only Markdown is staged, which the check doesn't read";
	if (alreadyPassed(cwd, "index")) return "the check already passed on exactly the staged files";
	return undefined;
}
