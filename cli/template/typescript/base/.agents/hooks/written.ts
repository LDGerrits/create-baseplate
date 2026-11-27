// The files a shell command wrote. Agents often write files from the shell (heredocs, sed, python)
// rather than with their edit tools, and then the edit hook and the language server never see them.
// The guard, which runs before each shell command, stamps the time; after the command, the edit hook
// takes the game's files written since then and checks them as it checks an edit.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Payload } from "./guard.ts";

// Each agent tool's shell tool: Claude Code's and Codex's Bash, Gemini CLI's run_shell_command,
// Copilot's bash and powershell, Cursor's Shell and its afterShellExecution hook.
const SHELL_TOOLS = /^(Bash|bash|powershell|run_shell_command|Shell|shell)$/;

/** Whether this tool call ran a shell command. */
export const isShell = (payload: Payload) =>
	SHELL_TOOLS.test(payload.tool_name ?? payload.toolName ?? "") ||
	// Cursor's own hook for shell commands names no tool.
	/ShellExecution$/.test(payload.hook_event_name ?? "");

/**
 * Where the time before this project's last shell command is kept: inside the game, so its time and
 * the written files' come from the same filesystem's clock (a game under /mnt/c on WSL has another).
 */
const stampFile = (root: string) => path.join(root, "node_modules", ".cache", "baseplate-shell-started");

/** Notes the time, just before a shell command runs in `root`. */
export function stampShell(root: string) {
	try {
		fs.mkdirSync(path.dirname(stampFile(root)), { recursive: true });
		fs.writeFileSync(stampFile(root), "");
	} catch {}
}

/** When the last shell command in `root` started, or undefined without a stamp. */
export const shellStarted = (root: string) => fs.statSync(stampFile(root), { throwIfNoEntry: false })?.mtimeMs;

/**
 * A command that runs one of the game's mise tasks (the check, the tests, a build) reports on the
 * files itself, and some of those tasks write files of their own: nothing to add after it.
 */
export const runsTask = (command: string) =>
	/(^|[;&|(]|\n)\s*mise\s+(run|r)\b/.test(command) ||
	/(^|[;&|(]|\n)\s*mise\s+x\s+--\s+node\s+scripts\/check/.test(command);

/** Whether a shell command may have moved or deleted files, which leaves no new file to find. */
export const movesFiles = (command: string) => /(^|[;&|(]|\n)\s*(git\s+)?(mv|rm)\s/.test(command);
// Where the game's files are; installed, built and generated folders aren't the agent's writing.
const SOURCES = ["src", "tests", "world", "projects", "scripts", ".agents"];
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

/** The game's files under `root` written since `since` (ms), as paths from the root; a write in the same clock tick counts. */
export function writtenSince(root: string, since: number): string[] {
	const found: string[] = [];
	const walk = (dir: string) => {
		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const relative = dir === "" ? entry.name : `${dir}/${entry.name}`;
			if (entry.isDirectory()) {
				if (dir !== "" && !SKIPPED.has(entry.name)) walk(relative);
			} else if (
				entry.isFile() &&
				(fs.statSync(path.join(root, relative), { throwIfNoEntry: false })?.mtimeMs ?? 0) >= since
			) {
				found.push(relative);
			}
		}
	};
	walk(""); // the root's own files, not its folders
	for (const dir of SOURCES) walk(dir);
	return found;
}

/**
 * After mise.toml changed, records the tools' new pins and checksums in mise.lock, as a package
 * manager updates its lockfile: mise installs only what the lock lists. Returns what went wrong, if
 * anything (it takes a fraction of a second when nothing changed, and needs the network when a pin did).
 */
export function lockTools(root: string, written: string[]): string[] {
	if (!written.includes("mise.toml")) return [];
	const run = spawnSync("mise", ["lock"], {
		cwd: root,
		encoding: "utf8",
		shell: process.platform === "win32",
		// Inside the hook's own limit (Codex gives it 30 seconds).
		timeout: 25_000,
	});
	if (run.status === 0) return [];
	const said = `${run.stdout ?? ""}${run.stderr ?? ""}`
		.split("\n")
		.filter((line) => line.trim() !== "" && !/\bWARN\b/.test(line))
		.slice(-5)
		.join("\n");
	return [
		`mise.toml: \`mise lock\` failed, so mise won't install the new pin until it passes:\n${said || (run.error?.message ?? "")}`,
	];
}
