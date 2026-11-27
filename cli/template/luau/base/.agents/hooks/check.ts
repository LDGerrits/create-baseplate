import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { alreadyPassed, isMarkdown } from "./fingerprint.ts";
import { type Format, formatArg, projectRoot } from "./project.ts";

export interface StopPayload {
	cwd?: string;
	stop_hook_active?: boolean; // Claude Code, Codex, Copilot and Gemini CLI: this stop already continued once
	status?: string; // Cursor: "completed", "aborted" (the user pressed Stop) or "error"
	loop_count?: number; // Cursor: follow-ups so far
	workspace_roots?: string[]; // Cursor
}

const CURSOR_FOLLOW_UPS = 3;

export function wantsCheck(format: Format, payload: StopPayload): boolean {
	if (format !== "cursor") return true;
	// Only a finished turn: after Stop or an error, a follow-up would start the agent again.
	return payload.status === "completed" && (payload.loop_count ?? 0) < CURSOR_FOLLOW_UPS;
}

export function clip(output: string, max: number): string {
	if (output.length <= max) return output;
	const tail = Math.floor(max / 5);
	return `${output.slice(0, max - tail)}\n…\n${output.slice(-tail)}`;
}

export function failureOutput(format: Format, payload: StopPayload, output: string): object | undefined {
	const retried = format !== "cursor" && payload.stop_hook_active === true;
	if (retried) {
		// Copilot has no message for the user; the agent's own reply has to say it.
		if (format === "copilot") return undefined;
		return { systemMessage: `The agent stopped, but \`mise run check\` still fails:\n${clip(output, 2000)}` };
	}
	const message = `\`mise run check\` fails after your changes. Fix it, or tell the user why it stays failing:\n${clip(output, 6000)}`;
	switch (format) {
		case "cursor":
			return { followup_message: message };
		case "gemini":
			return { decision: "deny", reason: message };
		default:
			return { decision: "block", reason: message };
	}
}

const git = (...args: string[]) => {
	const run = spawnSync("git", args, { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 });
	return run.status === 0 ? run.stdout : Buffer.alloc(0);
};

const lastRun = (root: string) =>
	path.join(os.tmpdir(), `baseplate-check-${createHash("sha256").update(root).digest("hex").slice(0, 8)}`);
const SKIPPED = new Set([
	"node_modules",
	"out",
	"include",
	"build",
	"dist",
	"Packages",
	"ServerPackages",
	"DevPackages",
]);

export function changedSince(root: string, since: number): boolean {
	for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
		const at = path.join(root, entry.name);
		if (entry.isDirectory()) {
			if (!entry.name.startsWith(".") && !SKIPPED.has(entry.name) && changedSince(at, since)) return true;
		} else if (!isMarkdown(entry.name) && fs.statSync(at).mtimeMs > since) {
			return true;
		}
	}
	return false;
}

export function changedFiles(): string[] {
	if (git("rev-parse", "--is-inside-work-tree").toString("utf8").trim() !== "true") {
		const since = fs.statSync(lastRun(process.cwd()), { throwIfNoEntry: false })?.mtimeMs ?? 0;
		return changedSince(process.cwd(), since) ? ["."] : [];
	}
	return [
		...git("diff", "-z", "--name-only", "--relative", "HEAD").toString("utf8").split("\0"),
		...untracked(),
	].filter((file) => file !== "" && !isMarkdown(file));
}

const untracked = () =>
	git("ls-files", "-z", "--others", "--exclude-standard")
		.toString("utf8")
		.split("\0")
		.filter((file) => file !== "");

if (import.meta.main) {
	let payload: StopPayload = {};
	try {
		payload = JSON.parse(fs.readFileSync(0, "utf8")) as StopPayload;
	} catch {}
	const format = formatArg(process.argv[2]);
	if (!wantsCheck(format, payload)) process.exit(0);

	// The session's own folder: in a worktree session, CLAUDE_PROJECT_DIR still names the main checkout.
	const start = payload.cwd ?? payload.workspace_roots?.[0] ?? process.env.CLAUDE_PROJECT_DIR ?? ".";
	const root = projectRoot(start);
	if (root === undefined) process.exit(0);
	process.chdir(root);

	if (changedFiles().length === 0) process.exit(0);
	if (alreadyPassed(root, "files")) {
		console.error("check: passed already on exactly these files; skipped");
		process.exit(0);
	}

	const check = spawnSync("mise", ["run", "--quiet", "check"], {
		encoding: "utf8",
		shell: process.platform === "win32",
		maxBuffer: 64 * 1024 * 1024,
	});
	if (check.error !== undefined) process.exit(0);
	fs.writeFileSync(lastRun(root), "");
	if (check.status === 0) process.exit(0);
	const output = failureOutput(format, payload, `${check.stdout}${check.stderr}`.trim());
	if (output !== undefined) console.log(JSON.stringify(output));
}
