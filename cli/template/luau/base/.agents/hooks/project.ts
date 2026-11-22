// The project folder a hook acts on, in the session's own checkout. In a worktree session the hook
// file and CLAUDE_PROJECT_DIR can still be in the main checkout, so the checkout comes from the
// session's folder, and the project's place inside the repo (the root, or a subfolder of a bigger
// repo) from where this file sits.
import { spawnSync } from "node:child_process";
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
	if (hereTop === undefined || sessionTop === undefined) return undefined;
	return path.join(sessionTop, path.relative(hereTop, here));
}

// The reply format a hook speaks, from its first argument: each agent tool reads its own. Codex
// reads Claude Code's.
export type Format = "claude" | "cursor" | "copilot" | "gemini";

export function formatArg(arg: string | undefined): Format {
	return arg === "cursor" || arg === "copilot" || arg === "gemini" ? arg : "claude";
}
