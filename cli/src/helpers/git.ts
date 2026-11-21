import { spawnSync } from "node:child_process";

const git = (dir: string, ...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });

export const isGitInstalled = () => spawnSync("git", ["--version"]).status === 0;

/**
 * Makes the project its own git repo, unless it's already inside one. Returns why it didn't, if it
 * didn't.
 */
export function initGit(dir: string): string | undefined {
	if (!isGitInstalled()) return "git isn't installed, so the game isn't a git repo.";
	const inside = git(dir, "rev-parse", "--show-toplevel");
	if (inside.status === 0) {
		return `The game is inside the git repo at ${inside.stdout.trim()}, so it isn't a repo of its own. To make it one, run git init in it.`;
	}
	const init = git(dir, "init", "--quiet", "--initial-branch", "main");
	return init.status === 0 ? undefined : `git init failed, so the game isn't a git repo:\n${init.stderr.trim()}`;
}

/** The first commit. Once installed, the project's commit hook checks it. Returns the error, if any. */
export function commitAll(dir: string, message: string): string | undefined {
	git(dir, "add", "--all");
	const commit = git(dir, "commit", "--quiet", "--message", message);
	return commit.status === 0 ? undefined : `${commit.stdout}${commit.stderr}`.trim();
}
