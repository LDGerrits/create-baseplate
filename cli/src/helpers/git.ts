import { spawnSync } from "node:child_process";

const git = (dir: string, ...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });

export const isGitInstalled = () => spawnSync("git", ["--version"]).status === 0;

/** Makes the project its own git repo, unless it's already inside one. */
export function initGit(dir: string): boolean {
	if (git(dir, "rev-parse", "--is-inside-work-tree").status === 0) return false;
	return git(dir, "init", "--quiet", "--initial-branch", "main").status === 0;
}

/** The first commit. Once installed, the project's commit hook checks it. Returns the error, if any. */
export function commitAll(dir: string, message: string): string | undefined {
	git(dir, "add", "--all");
	const commit = git(dir, "commit", "--quiet", "--message", message);
	return commit.status === 0 ? undefined : `${commit.stdout}${commit.stderr}`.trim();
}
