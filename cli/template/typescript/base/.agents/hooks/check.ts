// Stop hook, for every agent tool that runs hooks: when files changed, run `mise run check` and hand
// any failure back to the agent before it ends its turn. `.agents/hooks/run` starts it, with the
// tool's reply format as the argument: claude (also Codex's), cursor, copilot or gemini.
// When the agent already had its chance in this stop and the check still fails, it may stop, so the
// hook can't loop, and the user is told the check fails where the tool can show it. Cursor says
// nothing of the earlier follow-up, so it gets a few follow-ups instead.
// The check records the state of the files it passed on (fingerprint.ts), and the hook skips the check
// on later stops until a file changes again, whether the agent ran the check itself or the hook did.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { alreadyPassed, CHECK_RECORD, isMarkdown, readRecord, stateId, writeRecord } from "./fingerprint.ts";
import { type Format, formatArg, projectRoot } from "./project.ts";

export interface StopPayload {
	cwd?: string;
	stop_hook_active?: boolean; // Claude Code, Codex, Copilot and Gemini CLI: this stop already continued once
	status?: string; // Cursor: "completed", "aborted" (the user pressed Stop) or "error"
	loop_count?: number; // Cursor: follow-ups so far
	workspace_roots?: string[]; // Cursor
}

const CURSOR_FOLLOW_UPS = 3;

/** Whether this stop should run the check at all, before looking at the files. */
export function wantsCheck(format: Format, payload: StopPayload): boolean {
	if (format !== "cursor") return true;
	// Only a finished turn: after Stop or an error, a follow-up would start the agent again.
	return payload.status === "completed" && (payload.loop_count ?? 0) < CURSOR_FOLLOW_UPS;
}

/** What to print after the check failed with this output, or undefined to print nothing. */
export function failureOutput(format: Format, payload: StopPayload, output: string): object | undefined {
	const retried = format !== "cursor" && payload.stop_hook_active === true;
	if (retried) {
		// Copilot has no message for the user; the agent's own reply has to say it.
		if (format === "copilot") return undefined;
		return { systemMessage: `The agent stopped, but \`mise run check\` still fails:\n${output.slice(-2000)}` };
	}
	const message = `\`mise run check\` fails after your changes. Fix it, or tell the user why it stays failing:\n${output.slice(-6000)}`;
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

/** The files this hook would check, relative to the current folder; Markdown changes need no check. */
export function changedFiles(): string[] {
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
	if (check.status === 0) {
		// The check records its own pass; this covers a game whose check predates the record.
		const state = stateId(root, "files");
		if (state !== undefined && readRecord(root, CHECK_RECORD) !== state) writeRecord(root, CHECK_RECORD, state);
		process.exit(0);
	}
	const output = failureOutput(format, payload, `${check.stdout}${check.stderr}`.trim());
	if (output !== undefined) console.log(JSON.stringify(output));
}
