// PreToolUse guard for Claude Code, Codex and Cursor. It turns the rules agents most often break
// here into blocks whose message says what to do instead. Pass "cursor" as the first argument for
// Cursor's reply format.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

interface Payload {
	cwd?: string;
	tool_name?: string;
	tool_input?: { command?: string; file_path?: string; path?: string; notebook_path?: string };
	command?: string; // Cursor's beforeShellExecution
	workspace_roots?: string[];
}

let payload: Payload = {};
try {
	payload = JSON.parse(fs.readFileSync(0, "utf8")) as Payload;
} catch {}
const cursor = process.argv[2] === "cursor";

const start = payload.cwd ?? payload.workspace_roots?.[0] ?? process.cwd();
const top = spawnSync("git", ["-C", start, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
const root = top.status === 0 ? top.stdout.trim() : start;

// Files that only their generator writes, and what to run instead.
const GENERATED: [RegExp, string][] = [
	[/^(out|include)\//, "the compiler writes it: edit the source in src/ and run `mise run check`"],
	[/^build\//, "builds write it: run `mise run build` or `mise run check`"],
	[/^node_modules\//, "pnpm writes it: `pnpm add <package>`, or a patch with `pnpm patch`"],
	[
		/^default\.project\.json$/,
		"Rogen writes it from default.rogen.json: change that, or the file layout, and run `mise run check`",
	],
	[
		/^game\.project\.json$/,
		"scripts/game-project.ts writes it from default.project.json and world/: run `mise run check`",
	],
	[/^src\/world\.d\.ts$/, "scripts/world-types.ts writes it from world/: change world/ and run `mise run check`"],
];

function checkFile(file: string): string | undefined {
	const relative = path.relative(root, path.resolve(start, file)).split(path.sep).join("/");
	for (const [pattern, fix] of GENERATED) {
		if (pattern.test(relative)) return `${relative} is generated, so edits to it are overwritten; ${fix}.`;
	}
	return undefined;
}

function checkCommand(command: string): string | undefined {
	if (/\bgit\b[^|;&]*\bcommit\b[^|;&]*(\s--no-verify\b|\s-[A-Za-z]*n[A-Za-z]*\b)/.test(command)) {
		return "The commit hook runs the check on what you commit; commit without --no-verify, and fix what it reports.";
	}
	if (/core\.hooksPath|HUSKY=0|LINT_STAGED/.test(command)) {
		return "Leave the commit hook on; commit normally and fix what it reports.";
	}
	if (/\b(npm|yarn|bun)\s+(i|install|add|ci|remove|rm|uninstall|update|up)\b/.test(command)) {
		return "This project's packages are pnpm's: `pnpm add <package>` (or `pnpm add -D`), `pnpm install --frozen-lockfile`.";
	}
	if (/(^|[\s;&|(])(npx|rbxtsc)\s/.test(command)) {
		return "Run tools through the project: `mise run check` compiles with Sloptor; other binaries with `pnpm exec <tool>`.";
	}
	if (
		/\b(cat|less|more|head|tail|grep|rg|sed|awk|bat|xxd|od|strings|base64|source)\b[^|;&]*(^|[\s/'"])\.env(\s|$|['"])/.test(
			command,
		)
	) {
		return ".env holds secret keys: don't print it. .env.example lists the names it can hold; ask the user which are set.";
	}
	return undefined;
}

// Codex reports file edits as an apply_patch command; its file names follow these markers.
const patched = (patch: string) =>
	[...patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm)].map((m) =>
		(m[1] ?? m[2] ?? "").trim(),
	);

const input = payload.tool_input ?? {};
const command = payload.command ?? input.command;
const files = [input.file_path, input.path, input.notebook_path].filter((file): file is string => file !== undefined);
let reason: string | undefined;
if (payload.tool_name === "apply_patch" && command !== undefined) {
	reason = patched(command)
		.map(checkFile)
		.find((r) => r !== undefined);
} else {
	reason =
		files.map(checkFile).find((r) => r !== undefined) ?? (command === undefined ? undefined : checkCommand(command));
}

if (cursor) {
	console.log(
		JSON.stringify(
			reason === undefined
				? { permission: "allow" }
				: { permission: "deny", agent_message: reason, user_message: reason },
		),
	);
} else if (reason !== undefined) {
	console.log(
		JSON.stringify({
			hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
		}),
	);
}
