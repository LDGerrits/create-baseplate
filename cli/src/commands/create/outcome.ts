import type { Rendered } from "../../domain/game/render.ts";

/** What became of making the game a git repo. */
export type Git = { state: "off" } | { state: "skipped"; reason: string } | { state: "repo" };

/** What became of installing the tools and packages. */
export type Install =
	| { state: "off" }
	| { state: "no-mise" }
	| { state: "failed"; error: string }
	| { state: "installed" };

/** What became of the first commit. A commit is checked when the game's commit hook, set up by the install, ran its check. */
export type Commit =
	| { state: "no-repo" }
	| { state: "waiting"; unlocked: string[] }
	| { state: "committed"; checked: boolean }
	| { state: "failed"; error: string };

/**
 * Whether the first commit can be made now. It waits when the add-ons left a lockfile behind that
 * only an install brings up to date: committed now, the game's locked install would fail on it.
 */
export function firstCommit(
	git: Git,
	install: Install,
	stale: Rendered["stale"],
): { state: "no-repo" } | { state: "waiting"; unlocked: string[] } | { state: "now"; checked: boolean } {
	if (git.state !== "repo") return { state: "no-repo" };
	const installed = install.state === "installed";
	const unlocked = installed
		? []
		: [
				...(stale.tools ? ["mise.lock doesn't record the add-ons' tools until `mise lock`"] : []),
				...(stale.packages ? ["pnpm-lock.yaml doesn't list the add-ons' packages until `pnpm install`"] : []),
				...(stale.wally ? ["wally.lock doesn't list the add-ons' packages until `mise run install`"] : []),
			];
	return unlocked.length > 0 ? { state: "waiting", unlocked } : { state: "now", checked: installed };
}
