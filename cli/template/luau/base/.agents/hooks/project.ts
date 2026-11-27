// The project folder a hook acts on, in the session's own checkout. In a worktree session the hook
// file and CLAUDE_PROJECT_DIR can still be in the main checkout, so the checkout comes from the
// session's folder, and the project's place inside the repo (the root, or a subfolder of a bigger
// repo) from where this file sits.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const toplevel = (dir: string) => {
	const result = spawnSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
	return result.status === 0 ? result.stdout.trim() : undefined;
};

export function projectRoot(sessionDir: string): string | undefined {
	const here = fs.realpathSync(path.resolve(import.meta.dirname, "../.."));
	const hereTop = toplevel(here);
	const sessionTop = toplevel(sessionDir);
	if (hereTop !== undefined && sessionTop !== undefined) return path.join(sessionTop, path.relative(hereTop, here));
	if (hereTop !== undefined) return undefined;
	// Outside git, the project holding these hooks, when the session is in it.
	try {
		const inside = path.relative(here, fs.realpathSync(path.resolve(sessionDir)));
		return inside.startsWith("..") || path.isAbsolute(inside) ? undefined : here;
	} catch {
		return undefined;
	}
}

// The reply format a hook speaks, from its first argument: each agent tool reads its own. Codex
// reads Claude Code's.
export type Format = "claude" | "cursor" | "copilot" | "gemini";

export function formatArg(arg: string | undefined): Format {
	return arg === "cursor" || arg === "copilot" || arg === "gemini" ? arg : "claude";
}

/**
 * Whether Claude Code runs the game's language server, which reports type errors after each edit
 * itself: `scripts/setup.ts` enables it in the main checkout's .claude/settings.local.json, under a
 * marketplace named after that checkout's path. It isn't there when `claude` wasn't installed when
 * the game's tools were, or a person skipped it.
 */
export function languageServerOn(root: string): boolean {
	try {
		// A git hook's variables (GIT_DIR, GIT_INDEX_FILE) would point git at another repository.
		const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
		const git = (...args: string[]) =>
			spawnSync("git", ["rev-parse", "--path-format=absolute", ...args], { cwd: root, encoding: "utf8", env });
		const common = git("--git-common-dir").stdout.trim();
		const own = git("--git-dir").stdout.trim();
		const prefix = spawnSync("git", ["rev-parse", "--show-prefix"], { cwd: root, encoding: "utf8", env }).stdout.trim();
		// In a linked worktree the main checkout registers it, for every worktree.
		const linked =
			common !== "" && own !== "" && path.resolve(common) !== path.resolve(own) && path.basename(common) === ".git";
		const main = fs.realpathSync.native(linked ? path.join(path.dirname(common), prefix) : root);
		const marketplace = `baseplate-${createHash("sha256").update(main).digest("hex").slice(0, 8)}`;
		const settings = JSON.parse(fs.readFileSync(path.join(main, ".claude", "settings.local.json"), "utf8")) as {
			enabledPlugins?: Record<string, boolean>;
		};
		return settings.enabledPlugins?.[`luau@${marketplace}`] === true;
	} catch {
		return false;
	}
}
