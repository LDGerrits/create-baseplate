import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const git = (cwd: string, args: string[], env: Record<string, string> = {}) =>
	spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...env }, maxBuffer: 256 * 1024 * 1024 });

const out = (cwd: string, args: string[], env?: Record<string, string>): string | undefined => {
	const run = git(cwd, args, env);
	return run.status === 0 ? run.stdout.trim() : undefined;
};

/** The tree of the files on disk (`files`) or of the index (`index`), or undefined when git can't say. */
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

/** The paths staged for the commit being made (a rename counts as the old path and the new one). */
export function stagedFiles(cwd: string): string[] {
	const run = git(cwd, ["diff", "--cached", "--no-renames", "--name-only", "-z", "--relative"]);
	return run.status === 0 ? run.stdout.split("\0").filter((file) => file !== "") : [];
}
