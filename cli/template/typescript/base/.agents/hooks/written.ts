import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { GENERATED, type Payload } from "./guard.ts";

const HALF_THE_EDIT_HOOKS_TIMEOUT_MS = 15_000;

// Each agent tool's shell tool: Claude Code's and Codex's Bash, Gemini CLI's run_shell_command,
// Copilot's bash and powershell, Cursor's Shell and its afterShellExecution hook.
const SHELL_TOOLS = /^(Bash|bash|powershell|run_shell_command|Shell|shell)$/;

export const isShell = (payload: Payload) =>
	SHELL_TOOLS.test(payload.tool_name ?? payload.toolName ?? "") ||
	// Cursor's own hook for shell commands names no tool.
	/ShellExecution$/.test(payload.hook_event_name ?? "");

/**
 * Where the time before this project's last shell command is kept: inside the game, so its time and
 * the written files' come from the same filesystem's clock (a game under /mnt/c on WSL has another).
 */
const stampFile = (root: string) => path.join(root, "node_modules", ".cache", "baseplate-shell-started");

export function stampShell(root: string) {
	try {
		fs.mkdirSync(path.dirname(stampFile(root)), { recursive: true });
		fs.writeFileSync(stampFile(root), "");
	} catch {}
}

export const shellStarted = (root: string) => fs.statSync(stampFile(root), { throwIfNoEntry: false })?.mtimeMs;

export const runsTask = (command: string) =>
	/(^|[;&|(]|\n)\s*mise\s+(run|r)\b/.test(command) ||
	/(^|[;&|(]|\n)\s*mise\s+x\s+--\s+node\s+scripts\/check/.test(command);

export const movesFiles = (command: string) => /(^|[;&|(]|\n)\s*(git\s+)?(mv|rm)\s/.test(command);
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

export function lockTools(root: string, written: string[]): string[] {
	if (!written.includes("mise.toml")) return [];
	const stamp = path.join(root, "node_modules", ".cache", "baseplate-mise-toml");
	let text = "";
	try {
		text = fs.readFileSync(path.join(root, "mise.toml"), "utf8");
		if (fs.readFileSync(stamp, "utf8") === text) return [];
	} catch {}
	const run = spawnSync("mise", ["lock"], {
		cwd: root,
		encoding: "utf8",
		shell: process.platform === "win32",
		timeout: HALF_THE_EDIT_HOOKS_TIMEOUT_MS,
	});
	if (run.status === 0) {
		try {
			fs.mkdirSync(path.dirname(stamp), { recursive: true });
			fs.writeFileSync(stamp, text);
		} catch {}
		return [];
	}
	const said = `${run.stdout ?? ""}${run.stderr ?? ""}`
		.split("\n")
		.filter((line) => line.trim() !== "" && !/\bWARN\b/.test(line))
		.slice(-5)
		.join("\n");
	return [
		`mise.toml: \`mise lock\` failed, so mise won't install the new pin until it passes:\n${said || (run.error?.message ?? "")}`,
	];
}

const GENERATORS =
	/\b(mise|rogen|rojo|wally|pnpm|npm|npx|sloptor|rbxtsc|forge|lune|stylua|selene|biome|eslint|node|git)\b/;

export function generatedWrites(command: string, written: string[]): string[] {
	if (GENERATORS.test(command)) return [];
	return written.flatMap((file) => {
		const fix = GENERATED.find(([pattern]) => pattern.test(file))?.[1];
		return fix === undefined ? [] : [`${file} is generated, so this edit will be overwritten; ${fix}.`];
	});
}
